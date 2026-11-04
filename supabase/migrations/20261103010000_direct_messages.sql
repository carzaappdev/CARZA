-- Direct messages: 1:1 threads between two people, reusing the messaging tables. A DM is a conversation
-- with no listing and no dealership, keyed by the ordered pair (dm_low, dm_high) so each pair has one
-- thread. Blocks work both ways: blocked pairs can't start or send, and their threads drop out of the inbox.

alter table public.conversations
  add column dm_low uuid references public.profiles (id) on delete cascade,
  add column dm_high uuid references public.profiles (id) on delete cascade,
  add constraint conversations_dm_pair check (
    (dm_low is null and dm_high is null) or (dm_low < dm_high and listing_id is null and dealership_id is null)
  );

create unique index conversations_dm_pair_uniq on public.conversations (dm_low, dm_high)
  where dm_low is not null;
create index conversations_dm_high_idx on public.conversations (dm_high) where dm_high is not null;

-- ---------------------------------------------------------------------------
-- No sending across a block. Checked on every insert, so it also covers threads that existed before.
-- ---------------------------------------------------------------------------
create or replace function private.messages_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_low uuid;
  v_high uuid;
begin
  perform private.enforce_rate_limit('message_send');
  new.body := btrim(new.body);
  select c.dm_low, c.dm_high into v_low, v_high from public.conversations c where c.id = new.conversation_id;
  if v_low is not null and private.is_blocked_pair(v_low, v_high) then
    raise exception 'You can’t message this account' using errcode = '42501';
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

-- The thread between the caller and p_user_id, created on first use. Starting is rate limited; reopening
-- an existing thread is not. Both read markers start at "now" so an empty thread is never unread.
create function public.start_direct_conversation(p_user_id uuid)
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
  if private.is_blocked_pair(v_uid, p_user_id) then
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

-- The caller's DM threads that have at least one message, newest first, minus blocked people.
-- Runs as the caller, so RLS on conversations, participants and messages applies.
create function public.direct_inbox(p_limit integer default 50)
returns table (
  conversation_id uuid,
  other_id uuid,
  other_username text,
  other_display_name text,
  other_avatar_path text,
  other_official boolean,
  last_body text,
  last_sender_id uuid,
  last_message_at timestamptz,
  unread boolean
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.id,
    p.id,
    p.username,
    p.display_name,
    p.avatar_path,
    p.official,
    m.body,
    m.sender_id,
    m.created_at,
    c.last_message_at > coalesce(me.last_read_at, '-infinity'::timestamptz)
  from public.conversation_participants me
  join public.conversations c on c.id = me.conversation_id and c.dm_low is not null
  join public.profiles p on p.id = case when c.dm_low = me.user_id then c.dm_high else c.dm_low end
  cross join lateral (
    select x.body, x.sender_id, x.created_at from public.messages x
    where x.conversation_id = c.id
    order by x.created_at desc
    limit 1
  ) m
  where me.user_id = (select auth.uid())
    and p.id <> all (coalesce((select private.blocked_ids()), '{}'))
  order by c.last_message_at desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
$$;

-- How many DM threads have something the caller hasn't read. Drives the header badge.
create function public.unread_direct_count()
returns integer
language sql
stable
security invoker
set search_path = ''
as $$
  select count(*)::integer
  from public.conversation_participants me
  join public.conversations c on c.id = me.conversation_id and c.dm_low is not null
  where me.user_id = (select auth.uid())
    and c.last_message_at > coalesce(me.last_read_at, '-infinity'::timestamptz)
    and (case when c.dm_low = me.user_id then c.dm_high else c.dm_low end)
      <> all (coalesce((select private.blocked_ids()), '{}'));
$$;

revoke all on function public.start_direct_conversation(uuid) from public, anon;
revoke all on function public.direct_inbox(integer) from public, anon;
revoke all on function public.unread_direct_count() from public, anon;
grant execute on function public.start_direct_conversation(uuid) to authenticated;
grant execute on function public.direct_inbox(integer) to authenticated;
grant execute on function public.unread_direct_count() to authenticated;

-- ---------------------------------------------------------------------------
-- Reports: people can report a message someone else sent them, never their own.
-- ---------------------------------------------------------------------------
drop policy "Users report visible content" on public.reports;
create policy "Users report visible content" on public.reports
  for insert to authenticated
  with check (
    reporter_id = (select auth.uid())
    and case target_type
      when 'listing' then exists (select 1 from public.listings l where l.id = target_id)
      when 'message' then exists (
        select 1 from public.messages m where m.id = target_id and m.sender_id <> (select auth.uid())
      )
      when 'user' then exists (select 1 from public.profiles p where p.id = target_id and p.id <> (select auth.uid()))
      when 'dealership' then exists (select 1 from public.dealerships d where d.id = target_id)
      when 'post' then exists (select 1 from public.posts p where p.id = target_id and p.author_id <> (select auth.uid()))
      when 'reel' then exists (select 1 from public.reels r where r.id = target_id and r.author_id <> (select auth.uid()))
      when 'event' then exists (select 1 from public.events e where e.id = target_id and e.host_id <> (select auth.uid()))
    end
  );
