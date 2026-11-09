-- Moderation tools: suspend an account (hides everything it posted, ends its sessions), remove content
-- with a record of who did it and why, delete an account (e.g. a child under 13), and a private place
-- to keep evidence. The action log is what "repeat offender" decisions are based on.

-- ---------------------------------------------------------------------------
-- Suspension. No grant: only the admin function below sets it.
-- ---------------------------------------------------------------------------
alter table public.profiles add column suspended_at timestamptz;
create index profiles_suspended_idx on public.profiles (suspended_at) where suspended_at is not null;

-- Suspended accounts disappear the same way blocked ones do: every "minus blocked people" policy and
-- feed already filters on this list. Admins still see them, to review and to lift a suspension.
create or replace function private.blocked_ids()
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
    union
    select p.id from public.profiles p
    where p.suspended_at is not null and p.id is distinct from (select auth.uid()) and not private.is_admin()
  ) s;
$$;

drop policy "Profiles are public" on public.profiles;
create policy "Profiles are public, minus suspended accounts" on public.profiles
  for select to anon, authenticated
  using (suspended_at is null or id = (select auth.uid()) or (select private.is_admin()));

-- ---------------------------------------------------------------------------
-- moderation_actions: who did what to whose content, and why. Admin-only.
-- ---------------------------------------------------------------------------
create table public.moderation_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid references public.profiles (id) on delete set null,
  action text not null check (action in ('remove_content', 'suspend', 'unsuspend', 'escalate', 'delete_account')),
  -- Not a foreign key: the record must outlive the account.
  target_user_id uuid,
  target_type public.report_target,
  target_id uuid,
  reason public.report_reason,
  note text check (char_length(note) <= 2000),
  created_at timestamptz not null default now()
);

create index moderation_actions_user_idx on public.moderation_actions (target_user_id, created_at desc);
create index moderation_actions_admin_idx on public.moderation_actions (admin_id);

alter table public.moderation_actions enable row level security;
revoke all on public.moderation_actions from anon, authenticated;
grant select on public.moderation_actions to authenticated;

create policy "Admins read the moderation log" on public.moderation_actions
  for select to authenticated using ((select private.is_admin()));
-- No write policies: rows come only from the admin functions below.

create function private.require_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Only admins can do that' using errcode = '42501';
  end if;
  return (select auth.uid());
end;
$$;

revoke all on function private.require_admin() from public, anon, authenticated;

-- Takes a post, reel, event or message down for everyone and records it against its owner.
create function public.admin_remove_content(
  p_target_type public.report_target,
  p_target_id uuid,
  p_reason public.report_reason default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_owner uuid;
begin
  case p_target_type
    when 'post' then delete from public.posts where id = p_target_id returning author_id into v_owner;
    when 'reel' then delete from public.reels where id = p_target_id returning author_id into v_owner;
    when 'event' then delete from public.events where id = p_target_id returning host_id into v_owner;
    when 'message' then delete from public.messages where id = p_target_id returning sender_id into v_owner;
    else raise exception 'That can''t be removed here' using errcode = '22023';
  end case;
  -- Already gone (the owner deleted it first): nothing to record.
  if v_owner is null then
    return;
  end if;
  insert into public.moderation_actions (admin_id, action, target_user_id, target_type, target_id, reason, note)
  values (v_admin, 'remove_content', v_owner, p_target_type, p_target_id, p_reason, p_note);
end;
$$;

-- Suspends or restores an account. Suspended: can't sign in, sessions ended, everything they posted is
-- hidden (but kept, so it can be restored or preserved as evidence). `p_action` is 'suspend',
-- 'escalate' (a suspension for something that must be reported and preserved) or 'unsuspend'.
create function public.admin_set_suspended(
  p_user_id uuid,
  p_action text,
  p_reason public.report_reason default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
  v_suspend boolean := p_action in ('suspend', 'escalate');
begin
  if p_action not in ('suspend', 'escalate', 'unsuspend') then
    raise exception 'Unknown action' using errcode = '22023';
  end if;
  if p_user_id = v_admin or exists (select 1 from public.profiles p where p.id = p_user_id and p.role = 'admin') then
    raise exception 'Admins can''t be suspended here' using errcode = '42501';
  end if;
  update public.profiles
  set suspended_at = case when v_suspend then coalesce(suspended_at, now()) end
  where id = p_user_id;
  if not found then
    raise exception 'Account not found' using errcode = 'P0002';
  end if;
  update auth.users set banned_until = case when v_suspend then 'infinity'::timestamptz end where id = p_user_id;
  if v_suspend then
    delete from auth.sessions where user_id = p_user_id;
  end if;
  insert into public.moderation_actions (admin_id, action, target_user_id, reason, note)
  values (v_admin, p_action, p_user_id, p_reason, p_note);
end;
$$;

-- Deletes an account and everything in it (for example a child under 13). Not for evidence cases:
-- those are suspended instead, so nothing is lost.
create function public.admin_delete_account(p_user_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid := private.require_admin();
begin
  if p_user_id = v_admin or exists (select 1 from public.profiles p where p.id = p_user_id and p.role = 'admin') then
    raise exception 'Admins can''t be deleted here' using errcode = '42501';
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user_id) then
    raise exception 'Account not found' using errcode = 'P0002';
  end if;
  insert into public.moderation_actions (admin_id, action, target_user_id, note)
  values (v_admin, 'delete_account', p_user_id, p_note);
  delete from auth.users where id = p_user_id;
end;
$$;

revoke all on function public.admin_remove_content(public.report_target, uuid, public.report_reason, text) from public, anon;
revoke all on function public.admin_set_suspended(uuid, text, public.report_reason, text) from public, anon;
revoke all on function public.admin_delete_account(uuid, text) from public, anon;
grant execute on function public.admin_remove_content(public.report_target, uuid, public.report_reason, text) to authenticated;
grant execute on function public.admin_set_suspended(uuid, text, public.report_reason, text) to authenticated;
grant execute on function public.admin_delete_account(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- Evidence: a private bucket with no policies, so only the server (secret key) can read or write it.
-- Files from escalated reports are moved here, out of public view, and kept for the legal hold.
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public) values ('evidence', 'evidence', false);
