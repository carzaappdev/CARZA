-- Messaging. consumer↔consumer: two participant rows. consumer↔dealer: one participant (the consumer) plus
-- conversations.dealership_id, and every member of that dealership can see the thread (leads belong to the
-- dealership, not one employee). Conversations start only from a listing, via start_conversation().

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references public.listings (id) on delete set null,
  dealership_id uuid references public.dealerships (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  last_message_at timestamptz not null default now(),
  dealership_last_read_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- One thread per (listing, buyer).
create unique index conversations_listing_buyer_uniq on public.conversations (listing_id, created_by)
  where listing_id is not null;
create index conversations_created_by_idx on public.conversations (created_by);
create index conversations_dealership_idx on public.conversations (dealership_id, last_message_at desc)
  where dealership_id is not null;

create trigger conversations_set_updated_at before update on public.conversations
  for each row execute function private.set_updated_at();

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  last_read_at timestamptz,
  last_emailed_at timestamptz,
  archived_at timestamptz,
  primary key (conversation_id, user_id)
);

create index conversation_participants_user_idx on public.conversation_participants (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid default auth.uid() references public.profiles (id) on delete set null,
  body text not null check (char_length(btrim(body)) between 1 and 4000),
  created_at timestamptz not null default now()
);

create index messages_conversation_created_idx on public.messages (conversation_id, created_at desc);
create index messages_sender_idx on public.messages (sender_id);

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create function private.is_conversation_member(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.conversation_participants p
    where p.conversation_id = p_conversation_id and p.user_id = (select auth.uid())
  ) or exists (
    select 1 from public.conversations c
    where c.id = p_conversation_id
      and c.dealership_id is not null
      and private.is_dealership_member(c.dealership_id)
  );
$$;

revoke all on function private.is_conversation_member(uuid) from public;
grant execute on function private.is_conversation_member(uuid) to authenticated;

-- Before insert: rate limit. After insert: bump thread, mark read for sender, notify the other side.
create function private.messages_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.enforce_rate_limit('message_send');
  new.body := btrim(new.body);
  return new;
end;
$$;

create trigger messages_before_insert before insert on public.messages
  for each row execute function private.messages_before_insert();

create function private.messages_after_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_conv public.conversations;
  v_sender_is_dealer boolean;
  v_sender_name text;
  v_data jsonb;
  v_recipient uuid;
begin
  select * into v_conv from public.conversations where id = new.conversation_id;

  v_sender_is_dealer := v_conv.dealership_id is not null and exists (
    select 1 from public.dealership_members m
    where m.dealership_id = v_conv.dealership_id and m.user_id = new.sender_id
  );

  if v_sender_is_dealer then
    select d.name into v_sender_name from public.dealerships d where d.id = v_conv.dealership_id;
    update public.conversations
      set last_message_at = new.created_at, dealership_last_read_at = new.created_at
      where id = v_conv.id;
  else
    select p.display_name into v_sender_name from public.profiles p where p.id = new.sender_id;
    update public.conversations set last_message_at = new.created_at where id = v_conv.id;
    update public.conversation_participants set last_read_at = new.created_at
      where conversation_id = v_conv.id and user_id = new.sender_id;
  end if;

  v_data := jsonb_build_object(
    'conversation_id', v_conv.id,
    'listing_id', v_conv.listing_id,
    'sender_name', coalesce(v_sender_name, 'Someone'),
    'preview', left(new.body, 100)
  );

  for v_recipient in
    select p.user_id from public.conversation_participants p
    where p.conversation_id = v_conv.id and p.user_id is distinct from new.sender_id
    union
    select m.user_id from public.dealership_members m
    where v_conv.dealership_id is not null and not v_sender_is_dealer
      and m.dealership_id = v_conv.dealership_id and m.user_id is distinct from new.sender_id
  loop
    -- One unread notification per thread: bump it instead of piling up.
    insert into public.notifications (user_id, type, data)
    values (v_recipient, 'new_message', v_data)
    on conflict (user_id, (data ->> 'conversation_id')) where type = 'new_message' and read_at is null
    do update set data = excluded.data, created_at = now();
  end loop;

  return null;
end;
$$;

create trigger messages_after_insert after insert on public.messages
  for each row execute function private.messages_after_insert();

-- ---------------------------------------------------------------------------
-- RLS + grants
-- ---------------------------------------------------------------------------
alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

revoke all on public.conversations, public.conversation_participants, public.messages from anon, authenticated;

grant select on public.conversations to authenticated;
create policy "Members see their conversations" on public.conversations
  for select to authenticated using (private.is_conversation_member(id));
-- No direct insert/update/delete: start_conversation() and mark_conversation_read().

grant select, update (archived_at) on public.conversation_participants to authenticated;
create policy "Members see participants" on public.conversation_participants
  for select to authenticated using (private.is_conversation_member(conversation_id));
create policy "Users archive their own threads" on public.conversation_participants
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

grant select, insert (conversation_id, body) on public.messages to authenticated;
create policy "Members read messages" on public.messages
  for select to authenticated using (private.is_conversation_member(conversation_id));
create policy "Members send messages as themselves" on public.messages
  for insert to authenticated
  with check (sender_id = (select auth.uid()) and private.is_conversation_member(conversation_id));
-- No update/delete: messages are kept intact as evidence for scam reports.

-- Realtime: only messages are published. Delivery respects the select policy above.
alter publication supabase_realtime add table public.messages;

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------
create function public.start_conversation(p_listing_id uuid, p_body text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_listing public.listings;
  v_conv_id uuid;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  select l.* into v_listing from public.listings l
  where l.id = p_listing_id
    and l.status in ('active', 'pending')
    and (l.seller_user_id is not null or private.is_verified_dealership(l.seller_dealership_id));

  if v_listing.id is null then
    raise exception 'This listing is not available.' using errcode = 'P0002';
  end if;
  if v_listing.seller_user_id = v_uid
     or (v_listing.seller_dealership_id is not null and private.is_dealership_member(v_listing.seller_dealership_id)) then
    raise exception 'You can''t message yourself about your own listing.' using errcode = 'P0001';
  end if;

  select c.id into v_conv_id from public.conversations c
  where c.listing_id = p_listing_id and c.created_by = v_uid;

  if v_conv_id is null then
    perform private.enforce_rate_limit('conversation_start');

    insert into public.conversations (listing_id, dealership_id, created_by)
    values (p_listing_id, v_listing.seller_dealership_id, v_uid)
    returning id into v_conv_id;

    insert into public.conversation_participants (conversation_id, user_id) values (v_conv_id, v_uid);
    if v_listing.seller_user_id is not null then
      insert into public.conversation_participants (conversation_id, user_id)
      values (v_conv_id, v_listing.seller_user_id);
    end if;
  end if;

  insert into public.messages (conversation_id, sender_id, body) values (v_conv_id, v_uid, p_body);
  return v_conv_id;
end;
$$;

create function public.mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if not private.is_conversation_member(p_conversation_id) then
    raise exception 'Conversation not found' using errcode = 'P0002';
  end if;

  update public.conversation_participants set last_read_at = now()
  where conversation_id = p_conversation_id and user_id = v_uid;

  if not found then
    update public.conversations set dealership_last_read_at = now() where id = p_conversation_id;
  end if;

  update public.notifications set read_at = now()
  where user_id = v_uid and type = 'new_message' and read_at is null
    and data ->> 'conversation_id' = p_conversation_id::text;
end;
$$;

revoke all on function public.start_conversation(uuid, text) from public, anon;
revoke all on function public.mark_conversation_read(uuid) from public, anon;
grant execute on function public.start_conversation(uuid, text) to authenticated;
grant execute on function public.mark_conversation_read(uuid) to authenticated;
