-- Age: Carza is 13+. Everyone gives a date of birth once (sign-up form, or the first screen after
-- Google/Apple sign-in). Under-13s can't have an account. Teens (13-17) get different rules from adults:
--   * no direct messages between an adult and a teen,
--   * hosts can mark an event 18+ (hidden from teens), and teens can't host events,
--   * no push alerts to teens at night.
-- Until someone gives a date of birth they are treated as a teen, the safer side of every rule.

-- ---------------------------------------------------------------------------
-- Date of birth and terms acceptance. Private; never client-writable directly.
-- ---------------------------------------------------------------------------
alter table public.profile_private
  add column birth_date date,
  add column terms_accepted_at timestamptz;

-- Age in whole years on a given day.
create function private.age_on(p_birth date, p_day date default current_date)
returns integer
language sql
immutable
set search_path = ''
as $$
  select extract(year from age(p_day, p_birth))::integer;
$$;

-- True for 13-17 and for anyone who hasn't given a date of birth yet.
create function private.is_minor(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select private.age_on(pp.birth_date) < 18 from public.profile_private pp where pp.user_id = p_user),
    true
  );
$$;

revoke all on function private.age_on(date, date), private.is_minor(uuid) from public, anon, authenticated;
grant execute on function private.is_minor(uuid) to anon, authenticated;

-- The caller's own age state, for the app: null until a date of birth is on file.
create function public.my_age_group()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when pp.birth_date is null then null
    when private.age_on(pp.birth_date) < 18 then 'teen'
    else 'adult'
  end
  from public.profile_private pp where pp.user_id = (select auth.uid());
$$;

-- One-time age check for accounts without a date of birth (Google/Apple sign-ins, and accounts from
-- before this existed). Returns 'ok', or 'under_age' after deleting the account: we don't keep
-- information about children under 13.
create function public.set_birth_date(p_birth_date date)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
begin
  if v_uid is null then
    raise exception 'Not signed in' using errcode = '42501';
  end if;
  if p_birth_date is null or p_birth_date > current_date or p_birth_date < date '1900-01-01' then
    raise exception 'Enter a real date of birth' using errcode = '22023';
  end if;
  if private.age_on(p_birth_date) < 13 then
    delete from auth.users where id = v_uid;
    return 'under_age';
  end if;
  update public.profile_private
  set birth_date = p_birth_date, terms_accepted_at = coalesce(terms_accepted_at, now())
  where user_id = v_uid and birth_date is null;
  if not found then
    raise exception 'Your date of birth is already set' using errcode = '42501';
  end if;
  return 'ok';
end;
$$;

revoke all on function public.my_age_group(), public.set_birth_date(date) from public, anon;
grant execute on function public.my_age_group(), public.set_birth_date(date) to authenticated;

-- Sign-up: the form sends the date of birth with the new account. Under 13 is refused here too, so the
-- rule holds even if someone skips the form's own check.
create or replace function private.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_display_name text;
  v_base text;
  v_username text;
  v_birth date;
begin
  if new.raw_user_meta_data ->> 'birth_date' ~ '^\d{4}-\d{2}-\d{2}$' then
    begin
      v_birth := (new.raw_user_meta_data ->> 'birth_date')::date;
    exception when others then
      v_birth := null;
    end;
  end if;
  if v_birth is not null and (v_birth > current_date or v_birth < date '1900-01-01') then
    v_birth := null;
  end if;
  if v_birth is not null and private.age_on(v_birth) < 13 then
    raise exception 'You must be at least 13 to use Carza' using errcode = 'CZ013';
  end if;

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
  insert into public.profile_private (user_id, birth_date, terms_accepted_at)
  values (new.id, v_birth, case when v_birth is not null then now() end);
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Messages: never between an adult and a teen.
-- ---------------------------------------------------------------------------
create function private.messages_age_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_low uuid;
  v_high uuid;
begin
  select c.dm_low, c.dm_high into v_low, v_high from public.conversations c where c.id = new.conversation_id;
  if v_low is not null and private.is_minor(v_low) <> private.is_minor(v_high) then
    raise exception 'You can’t message this account' using errcode = '42501';
  end if;
  return new;
end;
$$;

revoke all on function private.messages_age_rules() from public, anon, authenticated;

create trigger messages_age_rules before insert on public.messages
  for each row execute function private.messages_age_rules();

-- Whether the caller may message someone: not themselves, no block either way, same age group.
-- Drives the Message button, so people aren't offered a thread they can't use.
create function public.can_message(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select auth.uid()) is not null
    and p_user_id <> (select auth.uid())
    and not private.is_blocked_pair((select auth.uid()), p_user_id)
    and private.is_minor((select auth.uid())) = private.is_minor(p_user_id);
$$;

revoke all on function public.can_message(uuid) from public, anon;
grant execute on function public.can_message(uuid) to authenticated;

create or replace function public.start_direct_conversation(p_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_low uuid;
  v_high uuid;
  v_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if p_user_id is null or p_user_id = v_uid then
    raise exception 'You can’t message yourself.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception 'That account no longer exists.' using errcode = 'P0002';
  end if;
  -- Same answer for a block and for the adult/teen rule, so neither can be told apart.
  if private.is_blocked_pair(v_uid, p_user_id) or private.is_minor(v_uid) <> private.is_minor(p_user_id) then
    raise exception 'You can’t message this account.' using errcode = '42501';
  end if;

  v_low := least(v_uid, p_user_id);
  v_high := greatest(v_uid, p_user_id);

  select c.id into v_id from public.conversations c where c.dm_low = v_low and c.dm_high = v_high;
  if v_id is not null then
    return v_id;
  end if;

  perform private.enforce_rate_limit('conversation_start');

  -- ON CONFLICT: two people opening the thread at once land in the same one.
  insert into public.conversations (created_by, dm_low, dm_high)
  values (v_uid, v_low, v_high)
  on conflict (dm_low, dm_high) where dm_low is not null do nothing
  returning id into v_id;

  if v_id is null then
    select c.id into v_id from public.conversations c where c.dm_low = v_low and c.dm_high = v_high;
    return v_id;
  end if;

  insert into public.conversation_participants (conversation_id, user_id, last_read_at)
  values (v_id, v_low, now()), (v_id, v_high, now());
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Events: 18+ events are hidden from signed-in teens, and teens can't host.
-- ---------------------------------------------------------------------------
alter table public.events add column adults_only boolean not null default false;

grant insert (adults_only) on public.events to authenticated;
grant update (adults_only) on public.events to authenticated;

drop policy "Events are public, minus blocked hosts" on public.events;
create policy "Events are public, minus blocked hosts and 18+ events for teens" on public.events
  for select to anon, authenticated
  using (
    host_id <> all (coalesce((select private.blocked_ids()), '{}'))
    and (
      not adults_only
      or (select auth.uid()) is null
      or host_id = (select auth.uid())
      or not (select private.is_minor((select auth.uid())))
    )
  );

-- Only API callers are checked: the seed and admin SQL have no signed-in user.
create function private.events_age_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null and private.is_minor(new.host_id) then
    raise exception 'You must be 18 or older to host an event' using errcode = 'CZ018';
  end if;
  return new;
end;
$$;

create function private.event_rsvps_age_rules()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is not null
     and private.is_minor(new.user_id)
     and exists (select 1 from public.events e where e.id = new.event_id and e.adults_only) then
    raise exception 'This event is for adults' using errcode = 'CZ018';
  end if;
  return new;
end;
$$;

revoke all on function private.events_age_rules(), private.event_rsvps_age_rules()
  from public, anon, authenticated;

create trigger events_age_rules before insert on public.events
  for each row execute function private.events_age_rules();
create trigger event_rsvps_age_rules before insert on public.event_rsvps
  for each row execute function private.event_rsvps_age_rules();

-- ---------------------------------------------------------------------------
-- Push alerts: none to teens between 10pm and 6am. There's no stored timezone, so local time comes
-- from the home ZIP's longitude (15 degrees per hour; US Central when there's no ZIP). The in-app
-- notification is still created; only the push is skipped.
-- ---------------------------------------------------------------------------
create function private.in_teen_quiet_hours(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_minor(p_user) and (
    extract(hour from (now() at time zone 'utc') + make_interval(mins => (
      coalesce(
        (select pc.lng from public.profile_private pp join public.postal_codes pc on pc.code = pp.postal_code
         where pp.user_id = p_user),
        -90
      ) * 4
    )::integer))::integer
  ) not between 6 and 21;
$$;

revoke all on function private.in_teen_quiet_hours(uuid) from public, anon, authenticated;

create or replace function private.dispatch_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
begin
  if not exists (select 1 from public.push_subscriptions s where s.user_id = new.user_id) then
    return null;
  end if;
  if exists (
    select 1 from public.profile_private p where p.user_id = new.user_id and new.type = any (p.push_muted)
  ) then
    return null;
  end if;
  if private.in_teen_quiet_hours(new.user_id) then
    return null;
  end if;

  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_dispatch_url';
  if v_url is null then
    return null;
  end if;

  perform net.http_post(
    url := v_url,
    body := jsonb_build_object('notification_id', new.id),
    headers := jsonb_build_object('Content-Type', 'application/json'),
    timeout_milliseconds := 5000
  );
  return null;
exception when others then
  -- A push is a nice-to-have; never lose the in-app notification over it.
  raise warning 'dispatch_push failed: %', sqlerrm;
  return null;
end;
$$;
