-- Test drive requests (dealer listings only). All times are timestamptz (absolute instants); the UI renders
-- them in the dealership's IANA timezone. Every status change goes through an RPC; no direct writes.

create table public.test_drive_requests (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listings (id) on delete cascade,
  dealership_id uuid not null references public.dealerships (id) on delete cascade,
  requester_id uuid not null references public.profiles (id) on delete cascade,
  proposed_times timestamptz[] not null
    check (cardinality(proposed_times) between 1 and 3 and array_position(proposed_times, null) is null),
  confirmed_time timestamptz,
  -- Stored (not computed) because the exclusion constraint needs an immutable expression.
  confirmed_end timestamptz,
  duration_minutes smallint not null default 30 check (duration_minutes between 15 and 120),
  status public.test_drive_status not null default 'requested',
  requester_note text check (char_length(requester_note) <= 1000),
  dealer_note text check (char_length(dealer_note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint test_drive_confirmed_fields check (
    status not in ('confirmed', 'completed') or (confirmed_time is not null and confirmed_end is not null)
  ),
  constraint test_drive_end_after_start check (confirmed_end is null or confirmed_end > confirmed_time),
  -- No double-booking the same car.
  constraint test_drive_no_overlap exclude using gist (
    listing_id with =,
    tstzrange(confirmed_time, confirmed_end) with &&
  ) where (status = 'confirmed')
);

-- One open request per (listing, requester).
create unique index test_drive_open_request_uniq on public.test_drive_requests (listing_id, requester_id)
  where status in ('requested', 'confirmed');
create index test_drive_dealership_idx on public.test_drive_requests (dealership_id, status, created_at desc);
create index test_drive_requester_idx on public.test_drive_requests (requester_id, created_at desc);
create index test_drive_listing_idx on public.test_drive_requests (listing_id);

create trigger test_drive_requests_set_updated_at before update on public.test_drive_requests
  for each row execute function private.set_updated_at();

alter table public.test_drive_requests enable row level security;
revoke all on public.test_drive_requests from anon, authenticated;
grant select on public.test_drive_requests to authenticated;

create policy "Requesters and the dealership see test drives" on public.test_drive_requests
  for select to authenticated
  using (requester_id = (select auth.uid()) or private.is_dealership_member(dealership_id));

-- ---------------------------------------------------------------------------
-- RPCs (the only way to create or change a request)
-- ---------------------------------------------------------------------------
create function private.test_drive_notify(p_request public.test_drive_requests, p_type public.notification_type, p_to_dealer boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_data jsonb;
  v_member uuid;
begin
  v_data := jsonb_build_object(
    'test_drive_id', p_request.id,
    'listing_id', p_request.listing_id,
    'dealership_id', p_request.dealership_id,
    'confirmed_time', p_request.confirmed_time
  );
  if p_to_dealer then
    for v_member in select m.user_id from public.dealership_members m where m.dealership_id = p_request.dealership_id loop
      perform private.notify(v_member, p_type, v_data);
    end loop;
  else
    perform private.notify(p_request.requester_id, p_type, v_data);
  end if;
end;
$$;

revoke all on function private.test_drive_notify(public.test_drive_requests, public.notification_type, boolean) from public, anon, authenticated;

create function public.request_test_drive(
  p_listing_id uuid,
  p_proposed_times timestamptz[],
  p_note text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_listing public.listings;
  v_time timestamptz;
  v_request public.test_drive_requests;
begin
  if v_uid is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  perform private.enforce_rate_limit('test_drive_request');

  select l.* into v_listing from public.listings l
  where l.id = p_listing_id
    and l.status = 'active'
    and l.seller_dealership_id is not null
    and private.is_verified_dealership(l.seller_dealership_id);
  if v_listing.id is null then
    raise exception 'Test drives are only available for active dealer listings.' using errcode = 'P0002';
  end if;
  if private.is_dealership_member(v_listing.seller_dealership_id) then
    raise exception 'You can''t request a test drive from your own dealership.' using errcode = 'P0001';
  end if;

  if p_proposed_times is null or cardinality(p_proposed_times) not between 1 and 3
     or array_position(p_proposed_times, null) is not null then
    raise exception 'Propose between 1 and 3 times.' using errcode = '22023';
  end if;
  foreach v_time in array p_proposed_times loop
    if v_time < now() + interval '1 hour' or v_time > now() + interval '60 days' then
      raise exception 'Proposed times must be between 1 hour and 60 days from now.' using errcode = '22023';
    end if;
  end loop;

  insert into public.test_drive_requests (listing_id, dealership_id, requester_id, proposed_times, requester_note)
  values (p_listing_id, v_listing.seller_dealership_id, v_uid, p_proposed_times, p_note)
  returning * into v_request;

  perform private.test_drive_notify(v_request, 'test_drive_requested', true);
  return v_request.id;
end;
$$;

-- Dealer confirms (at any future time, usually one of the proposed ones) or declines.
create function public.respond_test_drive(
  p_request_id uuid,
  p_confirm boolean,
  p_time timestamptz default null,
  p_note text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.test_drive_requests;
begin
  select * into v_request from public.test_drive_requests where id = p_request_id for update;
  if v_request.id is null or not private.can_act_for_dealership(v_request.dealership_id) then
    raise exception 'Test drive request not found' using errcode = 'P0002';
  end if;
  if v_request.status <> 'requested' then
    raise exception 'This request has already been answered.' using errcode = 'P0001';
  end if;

  if p_confirm then
    if p_time is null or p_time < now() then
      raise exception 'Choose a time in the future.' using errcode = '22023';
    end if;
    update public.test_drive_requests
      set status = 'confirmed',
          confirmed_time = p_time,
          confirmed_end = p_time + make_interval(mins => duration_minutes),
          dealer_note = p_note
      where id = p_request_id
      returning * into v_request;
    perform private.test_drive_notify(v_request, 'test_drive_confirmed', false);
  else
    update public.test_drive_requests set status = 'declined', dealer_note = p_note
      where id = p_request_id
      returning * into v_request;
    perform private.test_drive_notify(v_request, 'test_drive_declined', false);
  end if;
end;
$$;

-- Either side can cancel an open request; the other side is notified.
create function public.cancel_test_drive(p_request_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.test_drive_requests;
  v_is_requester boolean;
begin
  select * into v_request from public.test_drive_requests where id = p_request_id for update;
  v_is_requester := v_request.requester_id = auth.uid();
  if v_request.id is null or not (v_is_requester or private.can_act_for_dealership(v_request.dealership_id)) then
    raise exception 'Test drive request not found' using errcode = 'P0002';
  end if;
  if v_request.status not in ('requested', 'confirmed') then
    raise exception 'This request can no longer be cancelled.' using errcode = 'P0001';
  end if;

  update public.test_drive_requests
    set status = 'cancelled',
        requester_note = case when v_is_requester then coalesce(p_note, requester_note) else requester_note end,
        dealer_note = case when v_is_requester then dealer_note else coalesce(p_note, dealer_note) end
    where id = p_request_id
    returning * into v_request;

  perform private.test_drive_notify(v_request, 'test_drive_cancelled', v_is_requester);
end;
$$;

create function public.complete_test_drive(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.test_drive_requests;
begin
  select * into v_request from public.test_drive_requests where id = p_request_id for update;
  if v_request.id is null or not private.can_act_for_dealership(v_request.dealership_id) then
    raise exception 'Test drive request not found' using errcode = 'P0002';
  end if;
  if v_request.status <> 'confirmed' or v_request.confirmed_time > now() then
    raise exception 'Only confirmed test drives that have started can be completed.' using errcode = 'P0001';
  end if;
  update public.test_drive_requests set status = 'completed' where id = p_request_id;
end;
$$;

-- When a listing stops being active (sold, removed, back to draft), open test drives are cancelled and the
-- requesters notified, so nobody shows up for a car that's gone and the open-request slot is freed.
create function private.cancel_test_drives_for_inactive_listing()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.test_drive_requests;
begin
  for v_request in
    update public.test_drive_requests
    set status = 'cancelled', dealer_note = coalesce(dealer_note, 'This car is no longer available.')
    where listing_id = new.id and status in ('requested', 'confirmed')
    returning *
  loop
    perform private.test_drive_notify(v_request, 'test_drive_cancelled', false);
  end loop;
  return null;
end;
$$;

create trigger listings_cancel_test_drives
  after update of status on public.listings
  for each row
  when (old.status in ('active', 'pending') and new.status not in ('active', 'pending'))
  execute function private.cancel_test_drives_for_inactive_listing();

-- When a dealership stops being verified (suspended, rejected, or back to pending after an identity change),
-- its open test drives are cancelled and requesters notified. AFTER UPDATE (not "of verification_status") so
-- it also catches the status flip made by the re-verification trigger.
create function private.cancel_test_drives_for_unverified_dealership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.test_drive_requests;
begin
  for v_request in
    update public.test_drive_requests
    set status = 'cancelled', dealer_note = coalesce(dealer_note, 'The dealership is temporarily unavailable.')
    where dealership_id = new.id and status in ('requested', 'confirmed')
    returning *
  loop
    perform private.test_drive_notify(v_request, 'test_drive_cancelled', false);
  end loop;
  return null;
end;
$$;

create trigger dealerships_cancel_test_drives
  after update on public.dealerships
  for each row
  when (old.verification_status = 'verified' and new.verification_status <> 'verified')
  execute function private.cancel_test_drives_for_unverified_dealership();

revoke all on function public.request_test_drive(uuid, timestamptz[], text) from public, anon;
revoke all on function public.respond_test_drive(uuid, boolean, timestamptz, text) from public, anon;
revoke all on function public.cancel_test_drive(uuid, text) from public, anon;
revoke all on function public.complete_test_drive(uuid) from public, anon;
grant execute on function public.request_test_drive(uuid, timestamptz[], text) to authenticated;
grant execute on function public.respond_test_drive(uuid, boolean, timestamptz, text) to authenticated;
grant execute on function public.cancel_test_drive(uuid, text) to authenticated;
grant execute on function public.complete_test_drive(uuid) to authenticated;
