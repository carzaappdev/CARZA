-- iPhone app push: the APNs device tokens each user turned alerts on for. Web push stays in
-- push_subscriptions; the dispatch hook now fires when the owner has either kind of device.
-- Additive only: the currently deployed code keeps working after this runs.

-- ---------------------------------------------------------------------------
-- native_push_tokens: one row per iPhone. Written only through save_native_push_token.
-- ---------------------------------------------------------------------------
create table public.native_push_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  -- APNs device token, lowercase hex. Only known to the device and Apple.
  token text not null unique check (token ~ '^[0-9a-f]{64,200}$'),
  created_at timestamptz not null default now()
);

create index native_push_tokens_user_idx on public.native_push_tokens (user_id, created_at desc);

alter table public.native_push_tokens enable row level security;

revoke all on public.native_push_tokens from anon, authenticated;
grant select, delete on public.native_push_tokens to authenticated;

create policy "Users see their own phones" on public.native_push_tokens
  for select to authenticated using (user_id = (select auth.uid()));

create policy "Users remove their own phones" on public.native_push_tokens
  for delete to authenticated using (user_id = (select auth.uid()));

-- Saves this phone's token for the signed-in user. A phone has one token, so when someone else signs
-- in on it the row moves to them. Keeps each user's 10 newest phones.
create function public.save_native_push_token(p_token text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then
    raise exception 'not signed in' using errcode = '42501';
  end if;

  insert into public.native_push_tokens (user_id, token)
  values (v_user, p_token)
  on conflict (token) do update set user_id = excluded.user_id, created_at = now();

  delete from public.native_push_tokens
  where user_id = v_user
    and id not in (
      select id from public.native_push_tokens where user_id = v_user order by created_at desc limit 10
    );
end;
$$;

revoke all on function public.save_native_push_token(text) from public, anon;
grant execute on function public.save_native_push_token(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Dispatch hook: same as before, but also fires for users with only an iPhone.
-- ---------------------------------------------------------------------------
create or replace function private.dispatch_push()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url text;
begin
  if not exists (select 1 from public.push_subscriptions s where s.user_id = new.user_id)
    and not exists (select 1 from public.native_push_tokens t where t.user_id = new.user_id) then
    return null;
  end if;
  if exists (
    select 1 from public.profile_private p where p.user_id = new.user_id and new.type = any (p.push_muted)
  ) then
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

revoke all on function private.dispatch_push() from public, anon, authenticated;
