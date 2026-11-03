-- My Garage: trims, build stories, photo galleries and mods on garage cars, plus a parts catalog that
-- is matched to each car by fitment (make, model and year range).

-- ---------------------------------------------------------------------------
-- Categories shared by mods (what you've done) and parts (what fits).
-- ---------------------------------------------------------------------------
create type public.part_category as enum (
  'tuning',
  'engine',
  'intake_exhaust',
  'suspension',
  'wheels_tires',
  'brakes',
  'exterior',
  'lighting',
  'interior',
  'electronics',
  'care'
);

-- ---------------------------------------------------------------------------
-- garage_cars: trim, build story and up to 7 more photos (photo_path stays the cover).
-- ---------------------------------------------------------------------------
alter table public.garage_cars
  add column trim_level text check (char_length(btrim(trim_level)) between 1 and 40),
  add column story text check (char_length(btrim(story)) between 1 and 1000),
  add column gallery_paths text[] not null default '{}',
  add column updated_at timestamptz not null default now(),
  -- Every gallery photo lives in the owner's folder of the post-photos bucket, like the cover.
  add constraint garage_cars_gallery_paths_check check (
    cardinality(gallery_paths) <= 7
    and array_position(gallery_paths, null) is null
    and (
      cardinality(gallery_paths) = 0
      or array_to_string(gallery_paths, '|') ~ (
        '^' || owner_id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)(\|' || owner_id::text
        || '/[0-9a-f-]{36}\.(jpg|png|webp))*$'
      )
    )
  ),
  -- Target for garage_mods' composite key, so a mod's owner is always its car's owner.
  add constraint garage_cars_id_owner_key unique (id, owner_id);

grant insert (trim_level, story, gallery_paths) on public.garage_cars to authenticated;
grant update (trim_level, story, gallery_paths) on public.garage_cars to authenticated;

create trigger garage_cars_set_updated_at before update on public.garage_cars
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- garage_mods: what's been done to a car. Public like the car. Up to 50 per car.
-- ---------------------------------------------------------------------------
create table public.garage_mods (
  id uuid primary key default gen_random_uuid(),
  car_id uuid not null,
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  category public.part_category not null,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  foreign key (car_id, owner_id) references public.garage_cars (id, owner_id) on delete cascade
);

create index garage_mods_car_idx on public.garage_mods (car_id, created_at);
create index garage_mods_owner_idx on public.garage_mods (owner_id);

alter table public.garage_mods enable row level security;

revoke all on public.garage_mods from anon, authenticated;
grant select on public.garage_mods to anon, authenticated;
grant insert (car_id, category, name) on public.garage_mods to authenticated;
grant delete on public.garage_mods to authenticated;

create policy "Mods are public, minus blocked people" on public.garage_mods
  for select to anon, authenticated
  using (owner_id <> all (coalesce((select private.blocked_ids()), '{}')));
-- The composite foreign key makes sure the car is theirs too.
create policy "Users add mods to their own cars" on public.garage_mods
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Users remove their own mods" on public.garage_mods
  for delete to authenticated using (owner_id = (select auth.uid()));

insert into private.rate_limit_buckets (bucket, max_count, window_seconds) values
  ('garage_mod_add', 100, 86400);

create function private.garage_mods_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enforce_rate_limit('garage_mod_add');
  -- Serialize per car so parallel inserts can't both squeeze past the cap.
  perform 1 from public.garage_cars where id = new.car_id for update;
  if (select count(*) from public.garage_mods m where m.car_id = new.car_id) >= 50 then
    raise exception 'A car holds up to 50 mods' using errcode = 'CZ409';
  end if;
  return new;
end;
$$;

revoke all on function private.garage_mods_before_insert() from public, anon, authenticated;

create trigger garage_mods_before_insert before insert on public.garage_mods
  for each row execute function private.garage_mods_before_insert();

-- ---------------------------------------------------------------------------
-- Parts catalog: reference data, read-only through the API, maintained with migrations (like the
-- vehicle catalog). A part fits through one or more fitment rows: model + years, a whole make, or
-- every car (make and model both null).
-- ---------------------------------------------------------------------------
create table public.parts (
  id smallint generated always as identity primary key,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  category public.part_category not null,
  brand text not null check (char_length(brand) between 1 and 40),
  name text not null check (char_length(name) between 1 and 80),
  blurb text not null check (char_length(blurb) between 1 and 200),
  -- Higher shows first among parts that fit equally well.
  rank smallint not null default 0
);

create table public.part_fitments (
  id integer generated always as identity primary key,
  part_id smallint not null references public.parts (id) on delete cascade,
  make_id smallint references public.vehicle_makes (id) on delete restrict,
  model_id integer,
  year_from smallint check (year_from between 1900 and 2100),
  year_to smallint check (year_to between 1900 and 2100),
  check (model_id is null or make_id is not null),
  check (year_from is null or year_to is null or year_from <= year_to),
  foreign key (make_id, model_id) references public.vehicle_models (make_id, id) on delete restrict
);

create index part_fitments_part_idx on public.part_fitments (part_id);
create index part_fitments_model_idx on public.part_fitments (model_id);
create index part_fitments_make_idx on public.part_fitments (make_id);

alter table public.parts enable row level security;
alter table public.part_fitments enable row level security;

revoke all on public.parts, public.part_fitments from anon, authenticated;
grant select on public.parts, public.part_fitments to anon, authenticated;

create policy "Anyone can read parts" on public.parts for select to anon, authenticated using (true);
create policy "Anyone can read part fitments" on public.part_fitments
  for select to anon, authenticated using (true);
-- No write policies: catalog changes only through migrations.

-- Parts that fit a car, best fit first: made for the model, then for the make, then for any car.
-- Among equal fits, categories the build doesn't touch yet come first. `installed` marks parts
-- already in the build. Runs as the caller, so a car hidden by a block returns nothing.
create function public.parts_for_car(p_car_id uuid, p_limit integer default 24)
returns table (
  id smallint,
  slug text,
  category public.part_category,
  brand text,
  name text,
  blurb text,
  fit text,
  installed boolean
)
language sql
stable
set search_path = ''
as $$
  with car as (
    select c.id, c.year, c.make_id, c.model_id from public.garage_cars c where c.id = p_car_id
  ),
  mods as (
    select m.category, lower(m.name) as name from public.garage_mods m where m.car_id = p_car_id
  ),
  matches as (
    select
      p.id,
      max(case when f.model_id is not null then 3 when f.make_id is not null then 2 else 1 end) as fit_rank
    from public.parts p
    join public.part_fitments f on f.part_id = p.id
    cross join car c
    where (f.make_id is null or f.make_id = c.make_id)
      and (f.model_id is null or f.model_id = c.model_id)
      and (f.year_from is null or c.year >= f.year_from)
      and (f.year_to is null or c.year <= f.year_to)
    group by p.id
  )
  select
    p.id, p.slug, p.category, p.brand, p.name, p.blurb,
    case m.fit_rank when 3 then 'model' when 2 then 'make' else 'universal' end as fit,
    exists (select 1 from mods where mods.name = lower(p.brand || ' ' || p.name)) as installed
  from matches m
  join public.parts p on p.id = m.id
  order by
    m.fit_rank desc,
    exists (select 1 from mods where mods.category = p.category) asc,
    p.rank desc,
    p.id
  limit least(greatest(coalesce(p_limit, 24), 1), 60);
$$;

revoke all on function public.parts_for_car(uuid, integer) from public;
grant execute on function public.parts_for_car(uuid, integer) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Starter catalog. Real, widely sold parts, named by brand and product line (exact part numbers
-- depend on trim and drivetrain, which the app tells people to check).
-- ---------------------------------------------------------------------------
insert into public.parts (slug, category, brand, name, blurb, rank) values
  -- Made for specific models
  ('cobb-accessport', 'tuning', 'COBB', 'Accessport', 'Handheld tuner with off-the-shelf maps, live gauges and code reading. Supports the turbo engines only.', 90),
  ('hondata-flashpro', 'tuning', 'Hondata', 'FlashPro', 'Plug-in ECU tuning for turbo Civics with base maps and datalogging.', 90),
  ('apr-ecu-upgrade', 'tuning', 'APR', 'ECU Upgrade', 'Stage 1 software for the 2.0T, flashed over the OBD port and reversible.', 90),
  ('ecutek-tuning', 'tuning', 'EcuTek', 'ECU tuning', 'Dealer-flashed ECU tune: sharper throttle, flatter torque curve, and launch control options.', 85),
  ('bootmod3-tuning', 'tuning', 'bootmod3', 'Flash tuning', 'App-based flash tuning for BMW B58 and B46 engines with off-the-shelf maps.', 90),
  ('invidia-q300-catback', 'intake_exhaust', 'Invidia', 'Q300 cat-back exhaust', 'Stainless cat-back with resonators for a deeper note that stays civil on the highway.', 70),
  ('cobb-sf-intake', 'intake_exhaust', 'COBB', 'SF intake system', 'Sealed cold-air intake that keeps the factory MAF calibration close for easy tuning.', 60),
  ('borla-atak-catback', 'intake_exhaust', 'Borla', 'ATAK cat-back exhaust', 'Borla''s loudest cat-back, straight-through stainless. V8 models.', 70),
  ('racing-beat-catback', 'intake_exhaust', 'Racing Beat', 'Cat-back exhaust', 'Long-time Mazda specialist. A sporty but drone-free cat-back for the ND.', 70),
  ('ie-cold-air-intake', 'intake_exhaust', 'Integrated Engineering', 'Cold air intake', 'Big-filter intake with a sealed airbox for the EA888 2.0T.', 60),
  ('mishimoto-intercooler', 'engine', 'Mishimoto', 'Performance intercooler', 'Larger front-mount intercooler that keeps intake temps down on tuned 1.5T engines.', 60),
  ('flyin-miata-suspension', 'suspension', 'Flyin'' Miata', 'Coilover suspension package', 'Street-and-track coilovers and sway bars tuned by the Miata specialists.', 75),
  ('whiteline-sway-bars', 'suspension', 'Whiteline', 'Adjustable sway bars', 'Thicker, adjustable front and rear bars that cut body roll and tune the balance.', 65),
  ('steeda-lowering-springs', 'suspension', 'Steeda', 'Lowering springs', 'About an inch lower with a firmer, street-friendly rate. Mustang specialists.', 65),
  ('unplugged-lowering-springs', 'suspension', 'Unplugged Performance', 'Lowering springs', 'Drops a Tesla about 1.2 in. and tightens handling without hurting ride much.', 70),
  ('bilstein-5100', 'suspension', 'Bilstein', '5100 Series shocks', 'Monotube truck and SUV shocks, sold for stock height or a leveled front end.', 75),
  ('ome-suspension', 'suspension', 'ARB Old Man Emu', 'Suspension lift kit', 'Overland-grade springs and shocks for a 2-3 in. lift that still rides well.', 70),
  ('rough-country-lift', 'suspension', 'Rough Country', '2.5 in. lift kit', 'Budget-friendly spacer and shock lift that clears 35 in. tires on a Wrangler.', 55),
  ('bfg-ko2', 'wheels_tires', 'BFGoodrich', 'All-Terrain T/A KO2 tires', 'The default all-terrain tire: tough sidewalls, good in mud and snow, quiet enough daily.', 60),
  ('bakflip-mx4', 'exterior', 'BAK', 'BAKFlip MX4 tonneau cover', 'Hard folding bed cover that locks and flips up in panels. Pick your bed length.', 60),
  ('hard-dog-roll-bar', 'interior', 'Hard Dog', 'Fuzion roll bar', 'Bolt-in roll bar for track days and peace of mind, sized to keep the soft top working.', 60),
  ('maxpider-floor-mats', 'interior', '3D MAXpider', 'KAGU floor mats', 'Laser-measured, raised-edge mats for the Model 3 and Model Y, including the frunk and trunk.', 50),
  -- Fits (almost) any car
  ('weathertech-floorliner', 'interior', 'WeatherTech', 'FloorLiner', 'Laser-measured, custom-fit liners that hold mud, snow and spills.', 40),
  ('bluedriver-obd2', 'electronics', 'BlueDriver', 'Bluetooth OBD2 scanner', 'Reads and clears check-engine codes on any 1996+ car from your phone.', 45),
  ('viofo-dash-cam', 'electronics', 'VIOFO', 'A229 Pro dash cam', 'Front and rear 4K/2K recording with parking mode. Simple to hardwire.', 35),
  ('noco-jump-starter', 'electronics', 'NOCO', 'Boost GB40 jump starter', 'Pocket lithium jump pack that starts most gas engines up to 6 liters.', 30),
  ('meguiars-gold-class-wash', 'care', 'Meguiar''s', 'Gold Class car wash', 'Rich, pH-balanced shampoo that''s gentle on wax and coatings.', 20),
  ('griots-g9-polisher', 'care', 'Griot''s Garage', 'G9 random orbital polisher', 'Beginner-friendly dual-action polisher for swirl removal and waxing.', 15);

create temporary table part_fit_seed (
  slug text not null,
  make text,
  model text,
  year_from smallint,
  year_to smallint
);

insert into part_fit_seed (slug, make, model, year_from, year_to) values
  ('cobb-accessport', 'Subaru', 'WRX', 2015, 2025),
  ('cobb-accessport', 'Ford', 'Mustang', 2015, 2023),
  ('cobb-accessport', 'Ford', 'F-150', 2015, 2025),
  ('cobb-accessport', 'Ford', 'Bronco', 2021, 2025),
  ('hondata-flashpro', 'Honda', 'Civic', 2016, 2025),
  ('apr-ecu-upgrade', 'Volkswagen', 'Golf GTI', 2015, 2024),
  ('apr-ecu-upgrade', 'Volkswagen', 'Golf R', 2015, 2024),
  ('ecutek-tuning', 'Subaru', 'BRZ', 2013, 2025),
  ('ecutek-tuning', 'Toyota', '86', 2017, 2021),
  ('ecutek-tuning', 'Toyota', 'GR86', 2022, 2025),
  ('bootmod3-tuning', 'BMW', '3 Series', 2019, 2025),
  ('bootmod3-tuning', 'BMW', '4 Series', 2021, 2025),
  ('bootmod3-tuning', 'BMW', 'Z4', 2019, 2025),
  ('bootmod3-tuning', 'Toyota', 'Supra', 2020, 2025),
  ('invidia-q300-catback', 'Subaru', 'WRX', 2015, 2021),
  ('cobb-sf-intake', 'Subaru', 'WRX', 2015, 2021),
  ('borla-atak-catback', 'Ford', 'Mustang', 2015, 2023),
  ('borla-atak-catback', 'Chevrolet', 'Camaro', 2016, 2024),
  ('racing-beat-catback', 'Mazda', 'MX-5 Miata', 2016, 2025),
  ('ie-cold-air-intake', 'Volkswagen', 'Golf GTI', 2015, 2021),
  ('ie-cold-air-intake', 'Volkswagen', 'Golf R', 2015, 2019),
  ('mishimoto-intercooler', 'Honda', 'Civic', 2016, 2021),
  ('flyin-miata-suspension', 'Mazda', 'MX-5 Miata', 1990, 2025),
  ('whiteline-sway-bars', 'Subaru', 'WRX', 2015, 2021),
  ('whiteline-sway-bars', 'Subaru', 'BRZ', 2013, 2025),
  ('whiteline-sway-bars', 'Toyota', '86', 2017, 2021),
  ('whiteline-sway-bars', 'Toyota', 'GR86', 2022, 2025),
  ('steeda-lowering-springs', 'Ford', 'Mustang', 2015, 2023),
  ('unplugged-lowering-springs', 'Tesla', 'Model 3', 2017, 2025),
  ('unplugged-lowering-springs', 'Tesla', 'Model Y', 2020, 2025),
  ('bilstein-5100', 'Jeep', 'Wrangler', 2007, 2025),
  ('bilstein-5100', 'Jeep', 'Gladiator', 2020, 2025),
  ('bilstein-5100', 'Toyota', 'Tacoma', 2005, 2023),
  ('bilstein-5100', 'Toyota', '4Runner', 2003, 2024),
  ('bilstein-5100', 'Toyota', 'Tundra', 2007, 2025),
  ('bilstein-5100', 'Ford', 'F-150', 2009, 2025),
  ('bilstein-5100', 'Ford', 'Ranger', 2019, 2023),
  ('bilstein-5100', 'Chevrolet', 'Silverado 1500', 2007, 2025),
  ('bilstein-5100', 'Chevrolet', 'Colorado', 2015, 2022),
  ('bilstein-5100', 'GMC', 'Sierra 1500', 2007, 2025),
  ('bilstein-5100', 'Ram', '1500', 2009, 2025),
  ('bilstein-5100', 'Nissan', 'Frontier', 2005, 2025),
  ('ome-suspension', 'Toyota', 'Tacoma', 2005, 2023),
  ('ome-suspension', 'Toyota', '4Runner', 2003, 2024),
  ('ome-suspension', 'Jeep', 'Wrangler', 2007, 2025),
  ('ome-suspension', 'Jeep', 'Gladiator', 2020, 2025),
  ('rough-country-lift', 'Jeep', 'Wrangler', 2018, 2025),
  ('bfg-ko2', 'Jeep', 'Wrangler', null, null),
  ('bfg-ko2', 'Jeep', 'Gladiator', null, null),
  ('bfg-ko2', 'Toyota', 'Tacoma', null, null),
  ('bfg-ko2', 'Toyota', '4Runner', null, null),
  ('bfg-ko2', 'Toyota', 'Tundra', null, null),
  ('bfg-ko2', 'Ford', 'F-150', null, null),
  ('bfg-ko2', 'Ford', 'Bronco', null, null),
  ('bfg-ko2', 'Ford', 'Ranger', null, null),
  ('bfg-ko2', 'Chevrolet', 'Silverado 1500', null, null),
  ('bfg-ko2', 'Chevrolet', 'Colorado', null, null),
  ('bfg-ko2', 'GMC', 'Sierra 1500', null, null),
  ('bfg-ko2', 'Ram', '1500', null, null),
  ('bfg-ko2', 'Nissan', 'Frontier', null, null),
  ('bakflip-mx4', 'Ford', 'F-150', 2015, 2025),
  ('bakflip-mx4', 'Toyota', 'Tacoma', 2016, 2023),
  ('bakflip-mx4', 'Toyota', 'Tundra', 2014, 2025),
  ('bakflip-mx4', 'Chevrolet', 'Silverado 1500', 2019, 2025),
  ('bakflip-mx4', 'GMC', 'Sierra 1500', 2019, 2025),
  ('bakflip-mx4', 'Ram', '1500', 2019, 2025),
  ('bakflip-mx4', 'Jeep', 'Gladiator', 2020, 2025),
  ('hard-dog-roll-bar', 'Mazda', 'MX-5 Miata', 1990, 2025),
  ('maxpider-floor-mats', 'Tesla', 'Model 3', 2017, 2025),
  ('maxpider-floor-mats', 'Tesla', 'Model Y', 2020, 2025),
  ('weathertech-floorliner', null, null, 2000, null),
  ('bluedriver-obd2', null, null, 1996, null),
  ('viofo-dash-cam', null, null, null, null),
  ('noco-jump-starter', null, null, null, null),
  ('meguiars-gold-class-wash', null, null, null, null),
  ('griots-g9-polisher', null, null, null, null);

-- Fail loudly on a typo instead of quietly widening a fitment to the whole make or every car.
do $$
begin
  if exists (
    select 1
    from part_fit_seed s
    left join public.parts p on p.slug = s.slug
    left join public.vehicle_makes mk on mk.name = s.make
    left join public.vehicle_models md on md.make_id = mk.id and md.name = s.model
    where p.id is null
      or (s.make is not null and mk.id is null)
      or (s.model is not null and md.id is null)
  ) then
    raise exception 'part_fit_seed has a part, make or model that isn''t in the catalog';
  end if;
end;
$$;

insert into public.part_fitments (part_id, make_id, model_id, year_from, year_to)
select p.id, mk.id, md.id, s.year_from, s.year_to
from part_fit_seed s
join public.parts p on p.slug = s.slug
left join public.vehicle_makes mk on mk.name = s.make
left join public.vehicle_models md on md.make_id = mk.id and md.name = s.model;

drop table part_fit_seed;
