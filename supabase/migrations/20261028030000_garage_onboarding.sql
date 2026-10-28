-- Garages (the cars on your profile), a home ZIP that places you, first-run onboarding, and people to
-- follow.

-- ---------------------------------------------------------------------------
-- garage_cars: public, like the rest of a profile. Up to 10 per person.
-- ---------------------------------------------------------------------------
create table public.garage_cars (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  year smallint not null check (year between 1900 and 2100),
  make_id smallint not null references public.vehicle_makes (id) on delete restrict,
  model_id integer not null,
  nickname text check (char_length(btrim(nickname)) between 1 and 40),
  -- Optional photo in the owner's folder of the post-photos bucket (uploaded through reserve_upload).
  photo_path text check (photo_path ~ ('^' || owner_id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$')),
  created_at timestamptz not null default now(),
  -- The model must belong to the make.
  foreign key (make_id, model_id) references public.vehicle_models (make_id, id) on delete restrict
);

create index garage_cars_owner_idx on public.garage_cars (owner_id, created_at);
create index garage_cars_model_idx on public.garage_cars (model_id);

alter table public.garage_cars enable row level security;

revoke all on public.garage_cars from anon, authenticated;
grant select on public.garage_cars to anon, authenticated;
grant insert (year, make_id, model_id, nickname, photo_path) on public.garage_cars to authenticated;
grant update (year, make_id, model_id, nickname, photo_path) on public.garage_cars to authenticated;
grant delete on public.garage_cars to authenticated;

create policy "Garages are public, minus blocked people" on public.garage_cars
  for select to anon, authenticated
  using (owner_id <> all (coalesce((select private.blocked_ids()), '{}')));
create policy "Users add their own cars" on public.garage_cars
  for insert to authenticated with check (owner_id = (select auth.uid()));
create policy "Users edit their own cars" on public.garage_cars
  for update to authenticated
  using (owner_id = (select auth.uid()))
  with check (owner_id = (select auth.uid()));
create policy "Users remove their own cars" on public.garage_cars
  for delete to authenticated using (owner_id = (select auth.uid()));

insert into private.rate_limit_buckets (bucket, max_count, window_seconds) values
  ('garage_add', 20, 86400);

create function private.garage_cars_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enforce_rate_limit('garage_add');
  -- Serialize per owner so two parallel inserts can't both squeeze past the cap.
  perform 1 from public.profiles where id = new.owner_id for update;
  if (select count(*) from public.garage_cars g where g.owner_id = new.owner_id) >= 10 then
    raise exception 'Garages hold up to 10 cars' using errcode = 'CZ409';
  end if;
  return new;
end;
$$;

revoke all on function private.garage_cars_before_insert() from public, anon, authenticated;

create trigger garage_cars_before_insert before insert on public.garage_cars
  for each row execute function private.garage_cars_before_insert();

-- ---------------------------------------------------------------------------
-- Home ZIP: setting profile_private.postal_code places you (private) and shows your city (public).
-- ---------------------------------------------------------------------------
alter table public.profile_private add column onboarded_at timestamptz;
-- Only the ZIP is client-set now; location is derived from it.
revoke update (location) on public.profile_private from authenticated;
grant update (postal_code) on public.profile_private to authenticated;

create function private.profile_private_place()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_postal record;
begin
  if new.postal_code is not distinct from old.postal_code then
    return new;
  end if;
  if new.postal_code is null then
    new.location := null;
    update public.profiles set city = null, region = null where id = new.user_id;
    return new;
  end if;
  select p.city, p.region, p.lat, p.lng into v_postal from public.postal_codes p where p.code = new.postal_code;
  if not found then
    raise exception 'Unknown ZIP code' using errcode = '22023';
  end if;
  new.location := extensions.st_setsrid(extensions.st_makepoint(v_postal.lng, v_postal.lat), 4326)::extensions.geography;
  update public.profiles set city = v_postal.city, region = v_postal.region where id = new.user_id;
  return new;
end;
$$;

revoke all on function private.profile_private_place() from public, anon, authenticated;

create trigger profile_private_place before update on public.profile_private
  for each row execute function private.profile_private_place();

-- Marks first-run setup done. Separate from the update grant so it can only be "now".
create function public.complete_onboarding()
returns void
language sql
security definer
set search_path = ''
as $$
  update public.profile_private set onboarded_at = coalesce(onboarded_at, now())
  where user_id = (select auth.uid());
$$;

revoke all on function public.complete_onboarding() from public, anon;
grant execute on function public.complete_onboarding() to authenticated;

-- ---------------------------------------------------------------------------
-- Featured people (picked by admins: founding members, clubs, local creators) lead suggestions.
-- ---------------------------------------------------------------------------
alter table public.profiles add column featured_at timestamptz;
-- No grant: only admins via SQL / service role set it.

-- People to follow: featured first, then people near you, then people who drive the same makes, then
-- the most followed. Never yourself, people you follow, or anyone across a block.
create function public.suggested_follows(p_limit integer default 12)
returns table (
  id uuid,
  username text,
  display_name text,
  avatar_path text,
  bio text,
  city text,
  region text,
  featured boolean,
  follower_count bigint,
  shared_makes integer,
  nearby boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select (select auth.uid()) as id,
      (select pp.location from public.profile_private pp where pp.user_id = (select auth.uid())) as location
  ),
  my_makes as (
    select distinct g.make_id from public.garage_cars g where g.owner_id = (select id from me)
  ),
  candidates as (
    select p.*, pp.location
    from public.profiles p
    left join public.profile_private pp on pp.user_id = p.id
    where p.id <> coalesce((select id from me), '00000000-0000-0000-0000-000000000000'::uuid)
      and not exists (select 1 from public.follows f where f.follower_id = (select id from me) and f.followee_id = p.id)
      and p.id <> all (coalesce(private.blocked_ids(), '{}'))
  )
  select
    c.id, c.username, c.display_name, c.avatar_path, c.bio, c.city, c.region,
    c.featured_at is not null as featured,
    (select count(*) from public.follows f where f.followee_id = c.id) as follower_count,
    (select count(distinct g.make_id)::int from public.garage_cars g where g.owner_id = c.id and g.make_id in (select make_id from my_makes)) as shared_makes,
    -- Within ~50 miles. Only a yes/no, so exact locations can't be worked out.
    coalesce(extensions.st_dwithin(c.location, (select location from me), 80467), false) as nearby
  from candidates c
  order by
    (c.featured_at is not null) desc,
    nearby desc,
    shared_makes desc,
    follower_count desc,
    c.created_at desc
  limit least(greatest(coalesce(p_limit, 12), 1), 50);
$$;

revoke all on function public.suggested_follows(integer) from public;
grant execute on function public.suggested_follows(integer) to anon, authenticated;
