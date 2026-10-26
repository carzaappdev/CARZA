-- Profiles (public, 1:1 with auth.users), private profile data, and in-app notifications.

-- ---------------------------------------------------------------------------
-- profiles: every column here is public by design
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,30}$'),
  display_name text not null check (char_length(btrim(display_name)) between 1 and 60),
  -- Must point inside the user's own folder in the avatars bucket.
  avatar_path text check (char_length(avatar_path) <= 300 and avatar_path like id::text || '/%' and position('..' in avatar_path) = 0),
  bio text check (char_length(bio) <= 500),
  city text check (char_length(city) <= 80),
  region text check (char_length(region) <= 80),
  role public.app_role not null default 'user',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();

alter table public.profiles enable row level security;

revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to anon, authenticated;
-- Column-level: users can never change their own `role` (or id/timestamps).
grant update (username, display_name, avatar_path, bio, city, region) on public.profiles to authenticated;

create policy "Profiles are public" on public.profiles
  for select to anon, authenticated using (true);

create policy "Users update their own profile" on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));
-- No insert policy (signup trigger creates rows). No delete policy (deleting the auth user cascades).

-- ---------------------------------------------------------------------------
-- profile_private: owner-only data (default search location)
-- ---------------------------------------------------------------------------
create table public.profile_private (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  postal_code text check (postal_code ~ '^[0-9]{5}$'),
  location extensions.geography(point, 4326),
  updated_at timestamptz not null default now()
);

create index profile_private_location_idx on public.profile_private using gist (location);

create trigger profile_private_set_updated_at before update on public.profile_private
  for each row execute function private.set_updated_at();

alter table public.profile_private enable row level security;

revoke all on public.profile_private from anon, authenticated;
grant select, update (postal_code, location) on public.profile_private to authenticated;

create policy "Users read their own private profile" on public.profile_private
  for select to authenticated using (user_id = (select auth.uid()));

create policy "Users update their own private profile" on public.profile_private
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Admin check (used by policies across the schema)
-- ---------------------------------------------------------------------------
create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Signup trigger: create profile + private row for every new auth user
-- ---------------------------------------------------------------------------
create function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_display_name text;
  v_base text;
  v_username text;
begin
  -- Name from the sign-up form (display_name) or from Google/Apple (full_name / name).
  -- Never derived from the email address, which would leak it publicly.
  v_display_name := left(btrim(coalesce(
    nullif(btrim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(btrim(new.raw_user_meta_data ->> 'name'), ''),
    'Carza member'
  )), 60);

  v_base := left(regexp_replace(lower(v_display_name), '[^a-z0-9]+', '', 'g'), 20);
  if char_length(v_base) < 3 then
    v_base := 'member';
  end if;

  loop
    v_username := v_base || '_' || substr(md5(random()::text), 1, 6);
    exit when not exists (select 1 from public.profiles where username = v_username);
  end loop;

  insert into public.profiles (id, username, display_name) values (new.id, v_username, v_display_name);
  insert into public.profile_private (user_id) values (new.id);
  return new;
end;
$$;

revoke all on function private.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.handle_new_user();

-- ---------------------------------------------------------------------------
-- notifications: in-app. Rows are only created by triggers/RPCs (security definer).
-- ---------------------------------------------------------------------------
create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  -- Ids + short display text only. Never secrets or full message bodies.
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index notifications_user_unread_idx on public.notifications (user_id) where read_at is null;
-- At most one UNREAD "new message" notification per conversation per user (it gets bumped instead).
create unique index notifications_unread_message_uniq on public.notifications (user_id, (data ->> 'conversation_id'))
  where type = 'new_message' and read_at is null;

alter table public.notifications enable row level security;

revoke all on public.notifications from anon, authenticated;
grant select, delete, update (read_at) on public.notifications to authenticated;

create policy "Users read their own notifications" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));

create policy "Users mark their own notifications read" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "Users delete their own notifications" on public.notifications
  for delete to authenticated using (user_id = (select auth.uid()));

-- Internal helper used by triggers/RPCs to create notifications.
create function private.notify(p_user_id uuid, p_type public.notification_type, p_data jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, type, data) values (p_user_id, p_type, p_data);
$$;

revoke all on function private.notify(uuid, public.notification_type, jsonb) from public, anon, authenticated;
