-- =============================================================================
-- Carza DEV seed. LOCAL / DEV ONLY. Never run against production.
-- `supabase db reset` runs this after migrations.
--
-- All seed users sign in with password: password1234
--   admin@carza.test (admin) · buyer1..3@carza.test (consumers / private sellers)
--   owner+staff for each dealership: lakeside-owner@, lakeside-staff@, metro-owner@, metro-staff@,
--   volt-owner@, volt-staff@ (all @carza.test)
--
-- METRO: placeholder until the launch city is chosen. Change ONLY the center below; everything else is
-- generated relative to it (dealerships, listings, users).
-- =============================================================================

-- Everything runs in ONE transaction: if the guard below fails, nothing after it can take effect, even
-- when run with plain `psql -f` (no ON_ERROR_STOP).
begin;

-- Hard stop: refuse to run anywhere but a fresh LOCAL stack. The local CLI stack uses the well-known
-- dev JWT secret; hosted projects never do. Seeding creates a known-password admin, so this must not
-- run against carza-dev or carza-prod (e.g. via `db push --include-seed`).
do $$
begin
  if current_setting('app.settings.jwt_secret', true) is distinct from 'super-secret-jwt-token-with-at-least-32-characters-long'
     or exists (select 1 from auth.users) then
    raise exception 'seed.sql refused: only runs on an empty local Supabase stack';
  end if;
end $$;

create temporary table seed_config as
select
  'Austin'::text as city,           -- {{METRO}} display city
  'TX'::text as region,             -- {{METRO}} state
  30.2672::double precision as lat, -- {{METRO}} center latitude
  -97.7431::double precision as lng, -- {{METRO}} center longitude
  'America/Chicago'::text as tz;    -- {{METRO}} IANA timezone

select setseed(0.42);

-- Deterministic ids so the seed is reproducible and easy to reference.
create function pg_temp.sid(label text) returns uuid language sql immutable as $$ select md5('carza-seed:' || label)::uuid $$;

-- A point `north_km` / `east_km` away from the metro center.
create function pg_temp.pt(north_km double precision, east_km double precision)
returns extensions.geography language sql stable as $$
  select extensions.st_setsrid(extensions.st_makepoint(
    c.lng + east_km / (111.32 * cos(radians(c.lat))),
    c.lat + north_km / 110.574
  ), 4326)::extensions.geography
  from seed_config c
$$;

-- -----------------------------------------------------------------------------
-- Users (auth.users + identities). The signup trigger creates profiles.
-- -----------------------------------------------------------------------------
create temporary table seed_users (label text primary key, email text, display_name text);
insert into seed_users values
  ('admin',          'admin@carza.test',          'Carza Admin'),
  ('buyer1',         'buyer1@carza.test',         'Jordan Reyes'),
  ('buyer2',         'buyer2@carza.test',         'Priya Shah'),
  ('buyer3',         'buyer3@carza.test',         'Marcus Lee'),
  ('lakeside-owner', 'lakeside-owner@carza.test', 'Dana Whitfield'),
  ('lakeside-staff', 'lakeside-staff@carza.test', 'Chris Novak'),
  ('metro-owner',    'metro-owner@carza.test',    'Luis Ortega'),
  ('metro-staff',    'metro-staff@carza.test',    'Ashley Kim'),
  ('volt-owner',     'volt-owner@carza.test',     'Elena Petrova'),
  ('volt-staff',     'volt-staff@carza.test',     'Sam Okafor');

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
)
select
  '00000000-0000-0000-0000-000000000000', pg_temp.sid(u.label), 'authenticated', 'authenticated', u.email,
  extensions.crypt('password1234', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('display_name', u.display_name),
  now() - interval '90 days', now(), '', '', '', ''
from seed_users u;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select
  gen_random_uuid(), pg_temp.sid(u.label), pg_temp.sid(u.label)::text,
  jsonb_build_object('sub', pg_temp.sid(u.label)::text, 'email', u.email, 'email_verified', true),
  'email', now(), now(), now()
from seed_users u;

-- Readable usernames + home areas.
update public.profiles p
set username = replace(u.label, '-', '_'), city = c.city, region = c.region
from seed_users u, seed_config c
where p.id = pg_temp.sid(u.label);

update public.profiles set role = 'admin' where id = pg_temp.sid('admin');

update public.profile_private pp
set postal_code = '78701', location = private.approximate_point(pg_temp.pt(3, -2))
where pp.user_id in (pg_temp.sid('buyer1'), pg_temp.sid('buyer2'), pg_temp.sid('buyer3'));

-- -----------------------------------------------------------------------------
-- Dealerships (2 verified, 1 pending) + members
-- -----------------------------------------------------------------------------
insert into public.dealerships (
  id, slug, name, description, phone, email, website, address_line1, city, region, postal_code,
  location, timezone, verification_status, verified_at, created_by
)
select pg_temp.sid(d.label), d.slug, d.name, d.description, d.phone, d.email, d.website, d.address,
  c.city, c.region, d.postal_code, pg_temp.pt(d.north_km, d.east_km), c.tz, d.status::public.verification_status,
  case when d.status = 'verified' then now() - interval '60 days' end, pg_temp.sid(d.label || '-owner')
from seed_config c, (values
  ('lakeside', 'lakeside-toyota-honda', 'Lakeside Toyota Honda',
   'Family-owned Toyota and Honda dealer. New, certified pre-owned, and a full service department.',
   '(512) 555-0141', 'sales@lakeside.example', 'https://lakeside.example', '4100 Lakeside Blvd', '78731',
   'verified', 8.0, -6.0),
  ('metro', 'metro-auto-exchange', 'Metro Auto Exchange',
   'Independent used-car lot. Every car inspected, financing for all credit types.',
   '(512) 555-0177', 'hello@metroauto.example', 'https://metroauto.example', '920 E Industrial Pkwy', '78741',
   'verified', -5.0, 4.0),
  ('volt', 'volt-velvet-motors', 'Volt & Velvet Motors',
   'Luxury and EV specialist. Hand-picked German performance cars and electric vehicles.',
   '(512) 555-0102', 'concierge@voltvelvet.example', 'https://voltvelvet.example', '300 Congress Ave', '78701',
   'pending', 1.0, 0.5)
) as d(label, slug, name, description, phone, email, website, address, postal_code, status, north_km, east_km);

insert into public.dealership_members (dealership_id, user_id, role)
select pg_temp.sid(d), pg_temp.sid(d || '-' || r), r::public.dealer_role
from unnest(array['lakeside', 'metro', 'volt']) as d, unnest(array['owner', 'staff']) as r;

-- -----------------------------------------------------------------------------
-- Vehicles + listings (~180 dealer, ~30 private)
-- -----------------------------------------------------------------------------
create temporary table seed_catalog (
  make text, model text, body public.body_style, fuel public.fuel_type, drive public.drivetrain,
  trans public.transmission, msrp integer, pool text
);
insert into seed_catalog values
  ('Toyota', 'Camry', 'sedan', 'gasoline', 'fwd', 'automatic', 29000, 'lakeside'),
  ('Toyota', 'Corolla', 'sedan', 'gasoline', 'fwd', 'cvt', 23000, 'lakeside'),
  ('Toyota', 'RAV4', 'suv', 'gasoline', 'awd', 'automatic', 32000, 'lakeside'),
  ('Toyota', 'Tacoma', 'pickup', 'gasoline', '4wd', 'automatic', 38000, 'lakeside'),
  ('Toyota', 'Highlander', 'suv', 'gasoline', 'awd', 'automatic', 42000, 'lakeside'),
  ('Toyota', 'Prius', 'hatchback', 'hybrid', 'fwd', 'cvt', 29000, 'lakeside'),
  ('Toyota', 'Tundra', 'pickup', 'gasoline', '4wd', 'automatic', 52000, 'lakeside'),
  ('Honda', 'Civic', 'sedan', 'gasoline', 'fwd', 'cvt', 25000, 'lakeside'),
  ('Honda', 'Accord', 'sedan', 'gasoline', 'fwd', 'cvt', 30000, 'lakeside'),
  ('Honda', 'CR-V', 'suv', 'gasoline', 'awd', 'cvt', 33000, 'lakeside'),
  ('Honda', 'Pilot', 'suv', 'gasoline', 'awd', 'automatic', 42000, 'lakeside'),
  ('Honda', 'Odyssey', 'minivan', 'gasoline', 'fwd', 'automatic', 40000, 'lakeside'),
  ('Ford', 'F-150', 'pickup', 'gasoline', '4wd', 'automatic', 50000, 'metro'),
  ('Ford', 'Explorer', 'suv', 'gasoline', 'awd', 'automatic', 40000, 'metro'),
  ('Ford', 'Mustang', 'coupe', 'gasoline', 'rwd', 'manual', 35000, 'metro'),
  ('Chevrolet', 'Silverado 1500', 'pickup', 'gasoline', '4wd', 'automatic', 48000, 'metro'),
  ('Chevrolet', 'Equinox', 'suv', 'gasoline', 'fwd', 'automatic', 29000, 'metro'),
  ('Jeep', 'Wrangler', 'suv', 'gasoline', '4wd', 'manual', 38000, 'metro'),
  ('Jeep', 'Grand Cherokee', 'suv', 'gasoline', '4wd', 'automatic', 44000, 'metro'),
  ('Subaru', 'Outback', 'wagon', 'gasoline', 'awd', 'cvt', 32000, 'metro'),
  ('Subaru', 'Crosstrek', 'crossover', 'gasoline', 'awd', 'cvt', 27000, 'metro'),
  ('Nissan', 'Rogue', 'suv', 'gasoline', 'awd', 'cvt', 30000, 'metro'),
  ('Hyundai', 'Tucson', 'suv', 'gasoline', 'awd', 'automatic', 30000, 'metro'),
  ('Kia', 'Telluride', 'suv', 'gasoline', 'awd', 'automatic', 40000, 'metro'),
  ('Mazda', 'CX-5', 'suv', 'gasoline', 'awd', 'automatic', 30000, 'metro'),
  ('Ram', '1500', 'pickup', 'gasoline', '4wd', 'automatic', 48000, 'metro'),
  ('Volkswagen', 'Golf GTI', 'hatchback', 'gasoline', 'fwd', 'manual', 33000, 'metro'),
  ('Tesla', 'Model 3', 'sedan', 'electric', 'rwd', 'automatic', 42000, 'volt'),
  ('Tesla', 'Model Y', 'suv', 'electric', 'awd', 'automatic', 48000, 'volt'),
  ('BMW', '3 Series', 'sedan', 'gasoline', 'rwd', 'automatic', 46000, 'volt'),
  ('BMW', 'X5', 'suv', 'gasoline', 'awd', 'automatic', 66000, 'volt'),
  ('Mercedes-Benz', 'C-Class', 'sedan', 'gasoline', 'rwd', 'automatic', 48000, 'volt'),
  ('Mercedes-Benz', 'GLE', 'suv', 'gasoline', 'awd', 'automatic', 63000, 'volt'),
  ('Audi', 'Q5', 'suv', 'gasoline', 'awd', 'dct', 47000, 'volt'),
  ('Lexus', 'RX', 'suv', 'hybrid', 'awd', 'cvt', 52000, 'volt'),
  ('Porsche', 'Macan', 'suv', 'gasoline', 'awd', 'dct', 65000, 'volt'),
  ('Rivian', 'R1T', 'pickup', 'electric', 'awd', 'automatic', 75000, 'volt'),
  ('Ford', 'Mustang Mach-E', 'suv', 'electric', 'awd', 'automatic', 45000, 'volt'),
  ('Hyundai', 'Ioniq 5', 'crossover', 'electric', 'awd', 'automatic', 46000, 'volt');

create temporary table seed_listings (
  n integer primary key, seller text, is_dealer boolean, make text, model text, body public.body_style,
  fuel public.fuel_type, drive public.drivetrain, trans public.transmission, msrp integer,
  year smallint, mileage integer, condition public.listing_condition, status public.listing_status,
  price_cents bigint, north_km double precision, east_km double precision, published_days_ago integer
);

do $$
declare
  v_plan text[] := array[]::text[];
  v_seller text;
  v_cat record;
  v_age integer;
  v_year smallint;
  v_miles integer;
  v_cond public.listing_condition;
  v_status public.listing_status;
  v_price numeric;
  v_n integer := 0;
  v_r double precision;
  v_this_year integer := extract(year from now())::integer;
begin
  -- 90 Lakeside, 80 Metro, 8 Volt (pending → drafts), 30 private (10 per buyer). Enough cars per model that
  -- price estimates (listing_insights needs 5+ comparables) show up in dev.
  v_plan := v_plan || array_fill('lakeside'::text, array[90]) || array_fill('metro'::text, array[80])
    || array_fill('volt'::text, array[8])
    || array_fill('buyer1'::text, array[10]) || array_fill('buyer2'::text, array[10]) || array_fill('buyer3'::text, array[10]);

  foreach v_seller in array v_plan loop
    v_n := v_n + 1;
    select * into v_cat from seed_catalog c
    where c.pool = case when v_seller like 'buyer%' then c.pool else v_seller end
    order by random() limit 1;

    v_r := random();
    if v_seller = 'lakeside' and v_r < 0.35 then
      v_age := 0; v_cond := 'new';
    elsif v_seller = 'lakeside' and v_r < 0.65 then
      v_age := 1 + floor(random() * 4)::integer; v_cond := 'certified';
    else
      v_age := 1 + floor(random() * 12)::integer; v_cond := 'used';
    end if;
    v_year := (v_this_year + 1 - v_age)::smallint;
    v_miles := case when v_cond = 'new' then 5 + floor(random() * 40)::integer
      else greatest(1500, (v_age * (9000 + random() * 6000))::integer) end;
    v_price := v_cat.msrp * power(0.92, v_age) * (0.92 + random() * 0.16)
      - case when v_cond = 'new' then 0 else v_miles * 0.02 end;
    v_price := greatest(3500, round(v_price / 100) * 100);

    v_r := random();
    v_status := case
      when v_seller = 'volt' then 'draft'
      when v_r < 0.80 then 'active'
      when v_r < 0.88 then 'pending'
      when v_r < 0.95 then 'sold'
      else 'draft' end;

    insert into seed_listings values (
      v_n, v_seller, v_seller not like 'buyer%', v_cat.make, v_cat.model, v_cat.body, v_cat.fuel, v_cat.drive,
      v_cat.trans, v_cat.msrp, v_year, v_miles, v_cond, v_status, (v_price * 100)::bigint,
      (random() - 0.5) * 50, (random() - 0.5) * 50, floor(random() * 45)::integer
    );
  end loop;
end $$;

insert into public.vehicles (
  id, owner_user_id, owner_dealership_id, vin, year, make_id, model_id, mileage, body_style, drivetrain,
  transmission, fuel_type, exterior_color, interior_color, trim_level
)
select
  pg_temp.sid('vehicle-' || s.n),
  case when s.is_dealer then null else pg_temp.sid(s.seller) end,
  case when s.is_dealer then pg_temp.sid(s.seller) end,
  (select string_agg(substr('ABCDEFGHJKLMNPRSTUVWXYZ0123456789', 1 + floor(random() * 33)::integer, 1), '')
   from generate_series(1, 17 + s.n * 0)),
  s.year, mk.id, md.id, s.mileage, s.body, s.drive, s.trans, s.fuel,
  (array['White', 'Black', 'Silver', 'Gray', 'Blue', 'Red', 'Green', 'Pearl'])[1 + floor(random() * 8)::integer],
  (array['Black', 'Gray', 'Beige', 'Brown'])[1 + floor(random() * 4)::integer],
  (array['Base', 'Sport', 'Limited', 'Premium', 'XLE', 'EX-L', 'Touring', null])[1 + floor(random() * 8)::integer]
from seed_listings s
join public.vehicle_makes mk on mk.name = s.make
join public.vehicle_models md on md.make_id = mk.id and md.name = s.model;

insert into public.listings (
  id, vehicle_id, seller_user_id, seller_dealership_id, status, condition, price_cents, description,
  stock_number, location, city, region, published_at, created_at
)
select
  pg_temp.sid('listing-' || s.n),
  pg_temp.sid('vehicle-' || s.n),
  case when s.is_dealer then null else pg_temp.sid(s.seller) end,
  case when s.is_dealer then pg_temp.sid(s.seller) end,
  s.status, s.condition, s.price_cents,
  case when s.is_dealer
    then format('%s %s %s in great shape. %s miles. Clean title, inspected, ready for a test drive.',
                s.year, s.make, s.model, to_char(s.mileage, 'FM999,999'))
    else format('Selling my %s %s %s. %s miles, always garage kept, all service records. Price is firm-ish, serious buyers only.',
                s.year, s.make, s.model, to_char(s.mileage, 'FM999,999'))
  end,
  case when s.is_dealer then upper(left(s.seller, 1)) || lpad(s.n::text, 5, '0') end,
  -- The listings trigger replaces this with the dealership location (dealer) or snaps it to the grid (private).
  pg_temp.pt(s.north_km, s.east_km), c.city, c.region,
  case when s.status <> 'draft' then now() - make_interval(days => s.published_days_ago) end,
  now() - make_interval(days => s.published_days_ago + 2)
from seed_listings s, seed_config c;

insert into public.listing_private_locations (listing_id, location, postal_code)
select pg_temp.sid('listing-' || s.n), pg_temp.pt(s.north_km, s.east_km), '78701'
from seed_listings s where not s.is_dealer;

-- -----------------------------------------------------------------------------
-- Conversations + messages (8 consumer↔dealer, 4 consumer↔consumer)
-- -----------------------------------------------------------------------------
create temporary table seed_threads as
with dealer_targets as (
  select s.n, row_number() over (order by s.n) as k from seed_listings s
  where s.is_dealer and s.seller <> 'volt' and s.status = 'active'
), private_targets as (
  select s.n, s.seller, row_number() over (order by s.n) as k from seed_listings s
  where not s.is_dealer and s.status = 'active'
)
select 'dealer'::text as kind, d.n, (array['buyer1', 'buyer2', 'buyer3'])[1 + (d.k % 3)] as buyer, null::text as seller, d.k
from dealer_targets d where d.k <= 8
union all
select 'private', p.n,
  (array['buyer1', 'buyer2', 'buyer3'])[1 + ((array_position(array['buyer1', 'buyer2', 'buyer3'], p.seller)) % 3)],
  p.seller, p.k
from private_targets p where p.k <= 4;

insert into public.conversations (id, listing_id, dealership_id, created_by, created_at)
select pg_temp.sid('conv-' || t.n), pg_temp.sid('listing-' || t.n), l.seller_dealership_id, pg_temp.sid(t.buyer),
  now() - make_interval(days => 6 + t.k::integer)
from seed_threads t join public.listings l on l.id = pg_temp.sid('listing-' || t.n);

insert into public.conversation_participants (conversation_id, user_id)
select pg_temp.sid('conv-' || t.n), pg_temp.sid(t.buyer) from seed_threads t
union all
select pg_temp.sid('conv-' || t.n), pg_temp.sid(t.seller) from seed_threads t where t.kind = 'private';

do $$
declare
  v_t record;
  v_lines text[];
  v_i integer;
  v_seller_user uuid;
  v_dealer_staff uuid;
begin
  for v_t in select * from seed_threads order by kind, k loop
    v_lines := case v_t.kind
      when 'dealer' then array[
        'Hi! Is this one still available?',
        'It is! Would you like to come see it this week?',
        'Yes please. Any flexibility on the price?',
        'We can talk numbers when you''re here. We also have financing options.',
        'Great. Does it have any accident history?',
        'Clean history report, I can send it over. Saturday morning works for us.'
      ]
      else array[
        'Hey, is your car still for sale?',
        'Yes, still available.',
        'Would you be open to a pre-purchase inspection?',
        'Sure, as long as it''s at a shop nearby.',
        'Perfect, I''ll set one up.'
      ] end;
    select l.seller_user_id into v_seller_user from public.listings l where l.id = pg_temp.sid('listing-' || v_t.n);
    v_dealer_staff := case when v_t.kind = 'dealer' then (
      select m.user_id from public.dealership_members m
      join public.listings l on l.seller_dealership_id = m.dealership_id
      where l.id = pg_temp.sid('listing-' || v_t.n) and m.role = 'staff') end;

    for v_i in 1 .. (3 + (v_t.k::integer % (cardinality(v_lines) - 2))) loop
      insert into public.messages (conversation_id, sender_id, body, created_at)
      values (
        pg_temp.sid('conv-' || v_t.n),
        case when v_i % 2 = 1 then pg_temp.sid(v_t.buyer) else coalesce(v_dealer_staff, v_seller_user) end,
        v_lines[v_i],
        now() - make_interval(days => 6 + v_t.k::integer) + make_interval(hours => v_i * 3)
      );
    end loop;
  end loop;
end $$;

-- -----------------------------------------------------------------------------
-- Test drives (dealer listings, dealership-local business hours, all statuses)
-- -----------------------------------------------------------------------------
create temporary table seed_drives as
select s.n, row_number() over (order by s.n) as k,
  (array['buyer1', 'buyer2', 'buyer3'])[1 + (row_number() over (order by s.n) % 3)::integer] as buyer
from seed_listings s
where s.is_dealer and s.seller <> 'volt' and s.status = 'active'
order by s.n
limit 8;

-- Local wall-clock time `days` from today at `hour`:00 in the dealership timezone, as an absolute instant.
create function pg_temp.local_slot(days integer, hour integer) returns timestamptz language sql stable as $$
  select ((date_trunc('day', now() at time zone c.tz) + make_interval(days => days, hours => hour)) at time zone c.tz)
  from seed_config c
$$;

insert into public.test_drive_requests (
  id, listing_id, dealership_id, requester_id, proposed_times, confirmed_time, confirmed_end, status,
  requester_note, dealer_note, created_at
)
select
  pg_temp.sid('drive-' || d.n),
  l.id, l.seller_dealership_id, pg_temp.sid(d.buyer),
  case when x.status = 'completed'
    then array[pg_temp.local_slot(-3, 10), pg_temp.local_slot(-3, 14)]
    else array[pg_temp.local_slot(2 + d.k::integer, 10), pg_temp.local_slot(2 + d.k::integer, 15), pg_temp.local_slot(3 + d.k::integer, 11)]
  end,
  case when x.status in ('confirmed', 'completed')
    then case when x.status = 'completed' then pg_temp.local_slot(-3, 10) else pg_temp.local_slot(2 + d.k::integer, 15) end end,
  case when x.status in ('confirmed', 'completed')
    then case when x.status = 'completed' then pg_temp.local_slot(-3, 10) else pg_temp.local_slot(2 + d.k::integer, 15) end
         + interval '30 minutes' end,
  x.status::public.test_drive_status,
  'I''d like to bring my partner along if that''s ok.',
  case x.status when 'confirmed' then 'See you then! Ask for Chris at the front desk.'
                when 'declined' then 'Sorry, that car has a pending deal.' end,
  now() - make_interval(days => 5 - d.k::integer % 4)
from seed_drives d
join public.listings l on l.id = pg_temp.sid('listing-' || d.n)
join (values (1, 'requested'), (2, 'requested'), (3, 'confirmed'), (4, 'confirmed'), (5, 'declined'),
             (6, 'cancelled'), (7, 'completed'), (8, 'requested')) as x(k, status) on x.k = d.k;

-- Matching in-app notifications for the dealer side (the RPCs create these in real use).
insert into public.notifications (user_id, type, data, created_at)
select m.user_id, 'test_drive_requested',
  jsonb_build_object('test_drive_id', t.id, 'listing_id', t.listing_id, 'dealership_id', t.dealership_id),
  t.created_at
from public.test_drive_requests t
join public.dealership_members m on m.dealership_id = t.dealership_id
where t.status = 'requested';

-- -----------------------------------------------------------------------------
-- Saved listings + reports
-- -----------------------------------------------------------------------------
insert into public.saved_listings (user_id, listing_id)
select pg_temp.sid(b), pg_temp.sid('listing-' || s.n)
from seed_listings s, unnest(array['buyer1', 'buyer2']) as b
where s.status = 'active' and s.n % 7 = 0
  and not exists (select 1 from seed_listings x where x.n = s.n and x.seller = b);

insert into public.reports (reporter_id, target_type, target_id, reason, details)
select pg_temp.sid('buyer3'), 'listing', pg_temp.sid('listing-' || s.n), 'scam',
  'Seller asked me to pay a deposit by gift card before seeing the car.'
from seed_listings s where not s.is_dealer and s.seller <> 'buyer3' and s.status = 'active'
order by s.n limit 1;

insert into public.reports (reporter_id, target_type, target_id, reason, details)
select pg_temp.sid('buyer2'), 'listing', pg_temp.sid('listing-' || s.n), 'misleading',
  'Photos don''t match the trim listed.'
from seed_listings s where s.is_dealer and s.seller = 'metro' and s.status = 'active'
order by s.n desc limit 1;

commit;
