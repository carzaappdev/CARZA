-- Events: anyone hosts a car event (meet, cruise, show); others RSVP.
-- Location is a US ZIP code (its centroid powers "near you"), plus a venue name and optional street address
-- that the host chooses to publish. Times are stored as instants with the event's own IANA timezone, so a
-- 7pm meet shows as 7pm wherever the viewer is.

-- ---------------------------------------------------------------------------
-- Rate limits: adds event_create and event_rsvp.
-- ---------------------------------------------------------------------------
create or replace function private.enforce_rate_limit(p_bucket text, p_subject uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_subject uuid := coalesce(p_subject, auth.uid());
  v_limit record;
  v_window_start timestamptz;
  v_count integer;
begin
  -- Limits apply to API callers, identified by the role PostgREST/Storage switched to (`anon` or
  -- `authenticated`). The `role` setting is unaffected by SECURITY DEFINER, unlike current_user.
  -- Direct SQL (migrations, seed, SQL editor) and the service role are trusted and skip.
  if coalesce(current_setting('role', true), 'none') not in ('anon', 'authenticated') then
    return;
  end if;
  if v_subject is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  -- Allow-list of buckets: (bucket, max events, window seconds). A bucket can have several windows.
  for v_limit in
    select l.max_count, l.window_seconds
    from (values
      ('message_send', 30, 60),
      ('message_send', 300, 86400),
      ('conversation_start', 10, 3600),
      ('conversation_start', 30, 86400),
      ('listing_create', 10, 86400),
      -- Keyed per dealership (not per staff member), so adding staff doesn't multiply it.
      ('dealer_listing_create', 2000, 86400),
      ('photo_upload', 200, 3600),
      ('photo_upload', 1000, 86400),
      ('profile_image_upload', 20, 3600),
      ('test_drive_request', 5, 3600),
      ('test_drive_request', 10, 86400),
      ('report_create', 20, 86400),
      ('dealer_apply', 3, 86400),
      ('invite_send', 50, 86400),
      ('post_create', 30, 3600),
      ('post_create', 200, 86400),
      ('post_like', 300, 3600),
      ('follow', 100, 3600),
      ('follow', 500, 86400),
      ('event_create', 5, 86400),
      ('event_create', 20, 604800),
      ('event_rsvp', 60, 3600)
    ) as l(bucket, max_count, window_seconds)
    where l.bucket = p_bucket
  loop
    v_window_start := to_timestamp(floor(extract(epoch from now()) / v_limit.window_seconds) * v_limit.window_seconds);

    insert into private.rate_limits as r (key, window_start)
    values (p_bucket || ':' || v_limit.window_seconds || ':' || v_subject, v_window_start)
    on conflict (key, window_start) do update set count = r.count + 1
    returning r.count into v_count;

    if v_count > v_limit.max_count then
      raise exception 'Rate limit exceeded for %', p_bucket using errcode = 'CZ429';
    end if;
  end loop;

  if not found then
    raise exception 'Unknown rate limit bucket %', p_bucket;
  end if;

  -- Opportunistic cleanup of expired windows (~1% of calls).
  if random() < 0.01 then
    delete from private.rate_limits where window_start < now() - interval '2 days';
  end if;
end;
$$;


-- ---------------------------------------------------------------------------
-- events
-- ---------------------------------------------------------------------------
create table public.events (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 100),
  description text not null default '' check (char_length(description) <= 2000),
  starts_at timestamptz not null,
  ends_at timestamptz,
  timezone text not null check (private.is_valid_timezone(timezone)),
  venue_name text not null check (char_length(btrim(venue_name)) between 1 and 100),
  address text check (char_length(address) <= 200),
  postal_code text not null check (postal_code ~ '^[0-9]{5}$'),
  -- Derived from postal_code by trigger; never client-set.
  city text,
  region text,
  location extensions.geography(point, 4326),
  -- Cover photo, uploaded through reserve_upload into the host's folder of the post-photos bucket.
  cover_path text check (
    cover_path ~ ('^' || host_id::text || '/[0-9a-f-]{36}\.(jpg|png|webp)$')
  ),
  capacity integer check (capacity between 1 and 10000),
  going_count integer not null default 0 check (going_count >= 0),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint events_end_after_start check (
    ends_at is null or (ends_at > starts_at and ends_at <= starts_at + interval '7 days')
  )
);

create index events_upcoming_idx on public.events (starts_at) where cancelled_at is null;
create index events_location_idx on public.events using gist (location);
create index events_host_idx on public.events (host_id, starts_at desc);

alter table public.events enable row level security;

revoke all on public.events from anon, authenticated;
grant select on public.events to anon, authenticated;
grant insert (title, description, starts_at, ends_at, timezone, venue_name, address, postal_code, cover_path, capacity)
  on public.events to authenticated;
grant update (title, description, starts_at, ends_at, timezone, venue_name, address, postal_code, cover_path, capacity, cancelled_at)
  on public.events to authenticated;
grant delete on public.events to authenticated;

create policy "Events are public" on public.events
  for select to anon, authenticated using (true);
create policy "Users host as themselves" on public.events
  for insert to authenticated with check (host_id = (select auth.uid()));
create policy "Hosts edit their events" on public.events
  for update to authenticated
  using (host_id = (select auth.uid()))
  with check (host_id = (select auth.uid()));
create policy "Hosts and admins delete events" on public.events
  for delete to authenticated using (host_id = (select auth.uid()) or private.is_admin());

create function private.events_before_write()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_postal record;
begin
  if tg_op = 'INSERT' then
    perform private.enforce_rate_limit('event_create');
    if new.starts_at <= now() then
      raise exception 'Events must start in the future' using errcode = '22023';
    end if;
  else
    -- Count-only updates come from the RSVP triggers.
    if (new.title, new.description, new.starts_at, new.ends_at, new.timezone, new.venue_name, new.address,
        new.postal_code, new.cover_path, new.capacity, new.cancelled_at)
       is not distinct from
       (old.title, old.description, old.starts_at, old.ends_at, old.timezone, old.venue_name, old.address,
        old.postal_code, old.cover_path, old.capacity, old.cancelled_at) then
      return new;
    end if;
    if old.cancelled_at is not null then
      raise exception 'Cancelled events can''t be changed' using errcode = '42501';
    end if;
    -- Cancelling is one-way, and the time is the server's.
    if new.cancelled_at is not null then
      new.cancelled_at := now();
    end if;
    if new.starts_at is distinct from old.starts_at and new.starts_at <= now() then
      raise exception 'Events must start in the future' using errcode = '22023';
    end if;
  end if;

  if tg_op = 'INSERT' or new.postal_code is distinct from old.postal_code then
    select p.city, p.region, p.lat, p.lng into v_postal from public.postal_codes p where p.code = new.postal_code;
    if not found then
      raise exception 'Unknown ZIP code' using errcode = '22023';
    end if;
    new.city := v_postal.city;
    new.region := v_postal.region;
    new.location := extensions.st_setsrid(extensions.st_makepoint(v_postal.lng, v_postal.lat), 4326)::extensions.geography;
  end if;
  return new;
end;
$$;

-- The host is always going to their own event.
create function private.events_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.event_rsvps (event_id, user_id) values (new.id, new.host_id);
  return null;
end;
$$;

revoke all on function private.events_before_write(), private.events_after_insert() from public, anon, authenticated;

create trigger events_before_write before insert or update on public.events
  for each row execute function private.events_before_write();
create trigger events_set_updated_at before update on public.events
  for each row execute function private.set_updated_at();

-- ---------------------------------------------------------------------------
-- event_rsvps: who's going. Public, like a guest list on an event page.
-- ---------------------------------------------------------------------------
create table public.event_rsvps (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index event_rsvps_user_idx on public.event_rsvps (user_id, created_at desc);

alter table public.event_rsvps enable row level security;

revoke all on public.event_rsvps from anon, authenticated;
grant select on public.event_rsvps to anon, authenticated;
grant insert (event_id) on public.event_rsvps to authenticated;
grant delete on public.event_rsvps to authenticated;

create policy "RSVPs are public" on public.event_rsvps
  for select to anon, authenticated using (true);
create policy "Users RSVP as themselves" on public.event_rsvps
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users cancel their own RSVP" on public.event_rsvps
  for delete to authenticated using (user_id = (select auth.uid()));

create function private.event_rsvps_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event record;
begin
  perform private.enforce_rate_limit('event_rsvp');
  -- Lock the event so two last-seat RSVPs can't both get in.
  select e.cancelled_at, e.starts_at, e.ends_at, e.capacity, e.going_count into v_event
  from public.events e where e.id = new.event_id for update;
  if not found then
    raise exception 'Event not found' using errcode = '23503';
  end if;
  if v_event.cancelled_at is not null then
    raise exception 'This event was cancelled' using errcode = '22023';
  end if;
  if coalesce(v_event.ends_at, v_event.starts_at + interval '6 hours') <= now() then
    raise exception 'This event has ended' using errcode = '22023';
  end if;
  if v_event.capacity is not null and v_event.going_count >= v_event.capacity then
    raise exception 'This event is full' using errcode = 'CZ409';
  end if;
  return new;
end;
$$;

create function private.event_rsvps_count()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    update public.events set going_count = going_count + 1 where id = new.event_id;
  else
    update public.events set going_count = greatest(going_count - 1, 0) where id = old.event_id;
  end if;
  return null;
end;
$$;

revoke all on function private.event_rsvps_before_insert(), private.event_rsvps_count() from public, anon, authenticated;

create trigger event_rsvps_before_insert before insert on public.event_rsvps
  for each row execute function private.event_rsvps_before_insert();
create trigger event_rsvps_count after insert or delete on public.event_rsvps
  for each row execute function private.event_rsvps_count();

create trigger events_after_insert after insert on public.events
  for each row execute function private.events_after_insert();


-- ---------------------------------------------------------------------------
-- Upcoming events, soonest first, optionally within p_radius_miles of a point. Runs as the caller.
-- ---------------------------------------------------------------------------
create function public.upcoming_events(
  p_lat double precision default null,
  p_lng double precision default null,
  p_radius_miles integer default 50,
  p_limit integer default 50
)
returns setof public.events
language sql
stable
set search_path = ''
as $$
  select e.*
  from public.events e
  where e.cancelled_at is null
    and coalesce(e.ends_at, e.starts_at + interval '6 hours') > now()
    and (
      p_lat is null or p_lng is null
      or extensions.st_dwithin(
        e.location,
        extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography,
        least(greatest(coalesce(p_radius_miles, 50), 1), 500) * 1609.344
      )
    )
  order by e.starts_at, e.id
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

grant execute on function public.upcoming_events(double precision, double precision, integer, integer) to anon, authenticated;
