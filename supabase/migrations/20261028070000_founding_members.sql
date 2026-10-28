-- Founding members: the first 1,000 accounts get a numbered badge, people can invite friends with a link
-- (the new account follows whoever invited them), and admins can feature people in "who to follow".

-- ---------------------------------------------------------------------------
-- Founding member numbers, given in signup order and never reused.
-- ---------------------------------------------------------------------------
alter table public.profiles add column founding_number integer unique check (founding_number between 1 and 1000);

update public.profiles p set founding_number = n.rn
from (select id, row_number() over (order by created_at, id) as rn from public.profiles) n
where p.id = n.id and n.rn <= 1000;

create function private.profiles_founding_number()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_next integer;
begin
  -- One signup at a time takes a number, so two can't get the same one.
  perform pg_advisory_xact_lock(hashtext('carza.founding_number'));
  select coalesce(max(founding_number), 0) + 1 into v_next from public.profiles;
  new.founding_number := case when v_next <= 1000 then v_next end;
  return new;
end;
$$;

revoke all on function private.profiles_founding_number() from public, anon, authenticated;

create trigger profiles_founding_number before insert on public.profiles
  for each row execute function private.profiles_founding_number();

-- ---------------------------------------------------------------------------
-- Invites: who brought you here. Set once, by the new account, in its first week.
-- ---------------------------------------------------------------------------
alter table public.profile_private add column invited_by uuid references public.profiles (id) on delete set null;

create function public.accept_invite(p_username text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_me uuid := auth.uid();
  v_inviter uuid;
begin
  if v_me is null then
    raise exception 'Sign in first' using errcode = '42501';
  end if;
  select id into v_inviter from public.profiles where username = lower(p_username);
  if v_inviter is null or v_inviter = v_me or private.is_blocked_pair(v_me, v_inviter) then
    return;
  end if;
  update public.profile_private pp set invited_by = v_inviter
  from public.profiles p
  where pp.user_id = v_me and p.id = v_me
    and pp.invited_by is null
    and p.created_at > now() - interval '7 days';
  if found then
    insert into public.follows (follower_id, followee_id) values (v_me, v_inviter)
    on conflict do nothing;
  end if;
end;
$$;

revoke all on function public.accept_invite(text) from public, anon;
grant execute on function public.accept_invite(text) to authenticated;

-- How many people someone has brought in (shown to them on their own profile).
create function public.my_invite_count()
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.profile_private where invited_by = (select auth.uid());
$$;

revoke all on function public.my_invite_count() from public, anon;
grant execute on function public.my_invite_count() to authenticated;

-- ---------------------------------------------------------------------------
-- Featured people (admins only).
-- ---------------------------------------------------------------------------
create function public.set_featured(p_user_id uuid, p_featured boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Only admins can feature people' using errcode = '42501';
  end if;
  update public.profiles
  set featured_at = case when p_featured then coalesce(featured_at, now()) end
  where id = p_user_id;
end;
$$;

revoke all on function public.set_featured(uuid, boolean) from public, anon;
grant execute on function public.set_featured(uuid, boolean) to authenticated;
