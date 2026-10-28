-- Trust & safety for the social app: block people, and report posts, reels and events.
--
-- A block works both ways, like Threads/Instagram: neither person sees the other's posts, reels or events,
-- and neither can reply to, like, follow or RSVP to the other. Blocking also removes any follows between
-- them. Only the blocker can see that a block exists.

-- ---------------------------------------------------------------------------
-- Rate limits move into a table, so a new bucket is one insert instead of a copy of the whole function.
-- ---------------------------------------------------------------------------
create table private.rate_limit_buckets (
  bucket text not null,
  window_seconds integer not null check (window_seconds > 0),
  max_count integer not null check (max_count > 0),
  primary key (bucket, window_seconds)
);
-- Not reachable through the API (unexposed schema, no grants), but RLS on by convention.
alter table private.rate_limit_buckets enable row level security;

insert into private.rate_limit_buckets (bucket, max_count, window_seconds) values
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
  ('event_rsvp', 60, 3600),
  ('reel_upload', 10, 3600),
  ('reel_upload', 30, 86400),
  ('reel_create', 10, 3600),
  ('reel_create', 30, 86400),
  ('reel_like', 300, 3600),
  ('block', 50, 3600),
  ('block', 200, 86400);

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

  -- A bucket can have several windows (e.g. per hour and per day).
  for v_limit in
    select b.max_count, b.window_seconds from private.rate_limit_buckets b where b.bucket = p_bucket
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
-- blocks
-- ---------------------------------------------------------------------------
create table public.blocks (
  blocker_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_not_self check (blocker_id <> blocked_id)
);

create index blocks_blocked_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;

revoke all on public.blocks from anon, authenticated;
grant select, delete on public.blocks to authenticated;
grant insert (blocked_id) on public.blocks to authenticated;

-- Private: nobody can find out who blocked them.
create policy "Users see who they blocked" on public.blocks
  for select to authenticated using (blocker_id = (select auth.uid()));
create policy "Users block as themselves" on public.blocks
  for insert to authenticated with check (blocker_id = (select auth.uid()));
create policy "Users unblock" on public.blocks
  for delete to authenticated using (blocker_id = (select auth.uid()));

-- Everyone the caller blocked or was blocked by. Empty when signed out. Policies wrap it in a scalar
-- subquery so it runs once per statement, not once per row.
create function private.blocked_ids()
returns uuid[]
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(array_agg(s.id), '{}')
  from (
    select b.blocked_id as id from public.blocks b where b.blocker_id = (select auth.uid())
    union
    select b.blocker_id from public.blocks b where b.blocked_id = (select auth.uid())
  ) s;
$$;

create function private.is_blocked_pair(p_a uuid, p_b uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.blocks b
    where (b.blocker_id = p_a and b.blocked_id = p_b) or (b.blocker_id = p_b and b.blocked_id = p_a)
  );
$$;

revoke all on function private.blocked_ids(), private.is_blocked_pair(uuid, uuid) from public;
grant execute on function private.blocked_ids() to anon, authenticated;

create function private.blocks_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enforce_rate_limit('block');
  return new;
end;
$$;

-- Blocking cuts existing ties: follows both ways, and the blocked person's RSVPs to the blocker's events.
create function private.blocks_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.follows
  where (follower_id = new.blocker_id and followee_id = new.blocked_id)
     or (follower_id = new.blocked_id and followee_id = new.blocker_id);
  delete from public.event_rsvps r
  using public.events e
  where r.event_id = e.id and e.host_id = new.blocker_id and r.user_id = new.blocked_id;
  return null;
end;
$$;

revoke all on function private.blocks_before_insert(), private.blocks_after_insert() from public, anon, authenticated;

create trigger blocks_before_insert before insert on public.blocks
  for each row execute function private.blocks_before_insert();
create trigger blocks_after_insert after insert on public.blocks
  for each row execute function private.blocks_after_insert();

-- ---------------------------------------------------------------------------
-- Hide blocked people's content (both directions).
-- ---------------------------------------------------------------------------
drop policy "Posts are public" on public.posts;
create policy "Posts are public, minus blocked people" on public.posts
  for select to anon, authenticated using (author_id <> all (coalesce((select private.blocked_ids()), '{}')));

drop policy "Reels are public" on public.reels;
create policy "Reels are public, minus blocked people" on public.reels
  for select to anon, authenticated using (author_id <> all (coalesce((select private.blocked_ids()), '{}')));

drop policy "Events are public" on public.events;
create policy "Events are public, minus blocked hosts" on public.events
  for select to anon, authenticated using (host_id <> all (coalesce((select private.blocked_ids()), '{}')));

-- ---------------------------------------------------------------------------
-- No interacting across a block. Foreign keys skip RLS, so these checks live in the insert triggers.
-- ---------------------------------------------------------------------------
create or replace function private.posts_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enforce_rate_limit('post_create');
  if new.reply_to_id is not null and exists (
    select 1 from public.posts p
    where p.id = new.reply_to_id and private.is_blocked_pair(new.author_id, p.author_id)
  ) then
    raise exception 'You can’t reply to this account' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function private.post_likes_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enforce_rate_limit('post_like');
  if exists (
    select 1 from public.posts p
    where p.id = new.post_id and private.is_blocked_pair(new.user_id, p.author_id)
  ) then
    raise exception 'You can’t like this post' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function private.reel_likes_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enforce_rate_limit('reel_like');
  if exists (
    select 1 from public.reels r
    where r.id = new.reel_id and private.is_blocked_pair(new.user_id, r.author_id)
  ) then
    raise exception 'You can’t like this reel' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function private.follows_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enforce_rate_limit('follow');
  if private.is_blocked_pair(new.follower_id, new.followee_id) then
    raise exception 'You can’t follow this account' using errcode = '42501';
  end if;
  return new;
end;
$$;

create or replace function private.event_rsvps_before_insert()
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
  select e.host_id, e.cancelled_at, e.starts_at, e.ends_at, e.capacity, e.going_count into v_event
  from public.events e where e.id = new.event_id for update;
  if not found then
    raise exception 'Event not found' using errcode = '23503';
  end if;
  if private.is_blocked_pair(new.user_id, v_event.host_id) then
    raise exception 'You can’t RSVP to this event' using errcode = '42501';
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

-- ---------------------------------------------------------------------------
-- Reports: posts, reels and events, with a snapshot so evidence survives deletion.
-- ---------------------------------------------------------------------------
create or replace function private.reports_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enforce_rate_limit('report_create');
  new.status := 'open';
  new.resolved_by := null;
  new.resolved_at := null;
  new.target_snapshot := case new.target_type
    when 'listing' then (
      select jsonb_build_object(
        'status', l.status, 'price_cents', l.price_cents, 'description', l.description,
        'seller_user_id', l.seller_user_id, 'seller_dealership_id', l.seller_dealership_id,
        'vehicle', jsonb_build_object('year', v.year, 'make_id', v.make_id, 'model_id', v.model_id, 'vin', v.vin)
      )
      from public.listings l join public.vehicles v on v.id = l.vehicle_id where l.id = new.target_id
    )
    when 'message' then (
      select jsonb_build_object('conversation_id', m.conversation_id, 'sender_id', m.sender_id, 'body', m.body, 'sent_at', m.created_at)
      from public.messages m where m.id = new.target_id
    )
    when 'user' then (
      select jsonb_build_object('username', p.username, 'display_name', p.display_name, 'bio', p.bio)
      from public.profiles p where p.id = new.target_id
    )
    when 'dealership' then (
      select jsonb_build_object('name', d.name, 'slug', d.slug, 'website', d.website, 'phone', d.phone)
      from public.dealerships d where d.id = new.target_id
    )
    when 'post' then (
      select jsonb_build_object('author_id', p.author_id, 'body', p.body, 'photos', p.photos, 'reply_to_id', p.reply_to_id, 'created_at', p.created_at)
      from public.posts p where p.id = new.target_id
    )
    when 'reel' then (
      select jsonb_build_object('author_id', r.author_id, 'caption', r.caption, 'video_path', r.video_path, 'poster_path', r.poster_path, 'created_at', r.created_at)
      from public.reels r where r.id = new.target_id
    )
    when 'event' then (
      select jsonb_build_object('host_id', e.host_id, 'title', e.title, 'description', e.description, 'venue_name', e.venue_name, 'starts_at', e.starts_at)
      from public.events e where e.id = new.target_id
    )
  end;
  return new;
end;
$$;

-- You can only report things you can see (the subqueries run under your own RLS), and not your own.
drop policy "Users report visible content" on public.reports;
create policy "Users report visible content" on public.reports
  for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and case target_type
      when 'listing' then exists (select 1 from public.listings l where l.id = target_id)
      when 'message' then exists (select 1 from public.messages m where m.id = target_id)
      when 'user' then exists (select 1 from public.profiles p where p.id = target_id and p.id <> (select auth.uid()))
      when 'dealership' then exists (select 1 from public.dealerships d where d.id = target_id)
      when 'post' then exists (select 1 from public.posts p where p.id = target_id and p.author_id <> (select auth.uid()))
      when 'reel' then exists (select 1 from public.reels r where r.id = target_id and r.author_id <> (select auth.uid()))
      when 'event' then exists (select 1 from public.events e where e.id = target_id and e.host_id <> (select auth.uid()))
    end
  );
