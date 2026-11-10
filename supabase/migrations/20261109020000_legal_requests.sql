-- Legal requests from anyone, with or without an account: remove an intimate image (federal law gives
-- 48 hours), a copyright notice or counter-notice, a privacy request, or anything else for the team.
-- Each gets a ticket number and lands in the admin queue. Only admins can read them.

create table public.legal_requests (
  id uuid primary key default gen_random_uuid(),
  ticket text not null unique default ('CZ-' || upper(substr(md5(gen_random_uuid()::text), 1, 8))),
  kind text not null check (kind in ('intimate_image', 'copyright', 'copyright_counter', 'privacy', 'other')),
  name text not null check (char_length(btrim(name)) between 2 and 120),
  email text not null check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  -- Where the content is on Carza (links), and for copyright, where the original work is.
  urls text not null check (char_length(btrim(urls)) between 5 and 2000),
  statement text not null check (char_length(btrim(statement)) between 10 and 4000),
  -- Typed full name: an electronic signature under a good-faith (and, for copyright, sworn) statement.
  signature text not null check (char_length(btrim(signature)) between 2 and 120),
  -- Set when the sender was signed in. Not required: victims often have no account.
  user_id uuid references public.profiles (id) on delete set null,
  status text not null default 'open' check (status in ('open', 'actioned', 'rejected')),
  due_at timestamptz,
  admin_note text check (char_length(admin_note) <= 2000),
  resolved_by uuid references public.profiles (id) on delete set null,
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index legal_requests_open_idx on public.legal_requests (status, created_at);
create index legal_requests_email_idx on public.legal_requests (email, created_at desc);
create index legal_requests_user_idx on public.legal_requests (user_id);
create index legal_requests_resolved_by_idx on public.legal_requests (resolved_by);

alter table public.legal_requests enable row level security;

revoke all on public.legal_requests from anon, authenticated;
grant select on public.legal_requests to authenticated;
grant update (status, admin_note) on public.legal_requests to authenticated;

create policy "Admins read legal requests" on public.legal_requests
  for select to authenticated using ((select private.is_admin()));
create policy "Admins resolve legal requests" on public.legal_requests
  for update to authenticated
  using ((select private.is_admin()))
  with check ((select private.is_admin()));
-- No insert policy: requests come in through submit_legal_request only.

create function private.legal_requests_before_update()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    new.resolved_by := case when new.status = 'open' then null else (select auth.uid()) end;
    new.resolved_at := case when new.status = 'open' then null else now() end;
  end if;
  return new;
end;
$$;

revoke all on function private.legal_requests_before_update() from public, anon, authenticated;

create trigger legal_requests_before_update before update on public.legal_requests
  for each row execute function private.legal_requests_before_update();

-- Open to everyone, signed in or not, so it has its own limits instead of the per-user ones: a few a
-- day per email address, and a ceiling on the whole form so it can't be used to flood the queue.
create function public.submit_legal_request(
  p_kind text,
  p_name text,
  p_email text,
  p_urls text,
  p_statement text,
  p_signature text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(p_email));
  v_ticket text;
begin
  if (select count(*) from public.legal_requests r where r.email = v_email and r.created_at > now() - interval '1 day') >= 5
     or (select count(*) from public.legal_requests r where r.created_at > now() - interval '1 hour') >= 60 then
    raise exception 'Too many requests' using errcode = 'CZ429';
  end if;
  insert into public.legal_requests (kind, name, email, urls, statement, signature, user_id, due_at)
  values (
    p_kind, btrim(p_name), v_email, btrim(p_urls), btrim(p_statement), btrim(p_signature),
    (select auth.uid()),
    -- The 48 hours run from when the request arrives.
    case when p_kind = 'intimate_image' then now() + interval '48 hours' end
  )
  returning ticket into v_ticket;
  return v_ticket;
end;
$$;

revoke all on function public.submit_legal_request(text, text, text, text, text, text) from public;
grant execute on function public.submit_legal_request(text, text, text, text, text, text) to anon, authenticated;
