-- Cars people are bringing to an event. Only cars from your own garage, only while you're going, and up
-- to 3 per person. Public like the guest list. Cancelling the RSVP or removing the car drops the row.

create table public.event_rsvp_cars (
  event_id uuid not null,
  user_id uuid not null default auth.uid(),
  car_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (event_id, car_id),
  -- You must be going: cancelling the RSVP removes your cars.
  foreign key (event_id, user_id) references public.event_rsvps (event_id, user_id) on delete cascade,
  -- The car must be yours: deleting it from your garage removes it here.
  foreign key (car_id, user_id) references public.garage_cars (id, owner_id) on delete cascade
);

create index event_rsvp_cars_user_idx on public.event_rsvp_cars (event_id, user_id);
create index event_rsvp_cars_car_idx on public.event_rsvp_cars (car_id, user_id);

alter table public.event_rsvp_cars enable row level security;

revoke all on public.event_rsvp_cars from anon, authenticated;
grant select on public.event_rsvp_cars to anon, authenticated;
grant insert (event_id, car_id) on public.event_rsvp_cars to authenticated;
grant delete on public.event_rsvp_cars to authenticated;

create policy "Event cars are public, minus blocked people" on public.event_rsvp_cars
  for select to anon, authenticated
  using (user_id <> all (coalesce((select private.blocked_ids()), '{}')));
-- The foreign keys make sure the RSVP and the car are both the caller's.
create policy "Users bring their own cars" on public.event_rsvp_cars
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "Users take back their own cars" on public.event_rsvp_cars
  for delete to authenticated using (user_id = (select auth.uid()));

insert into private.rate_limit_buckets (bucket, max_count, window_seconds) values
  ('event_rsvp_car', 60, 3600);

create function private.event_rsvp_cars_before_insert()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event record;
begin
  perform private.enforce_rate_limit('event_rsvp_car');
  select e.cancelled_at, e.starts_at, e.ends_at into v_event from public.events e where e.id = new.event_id;
  if v_event.cancelled_at is not null then
    raise exception 'This event was cancelled' using errcode = '22023';
  end if;
  if coalesce(v_event.ends_at, v_event.starts_at + interval '6 hours') <= now() then
    raise exception 'This event has ended' using errcode = '22023';
  end if;
  -- Serialize per guest so parallel inserts can't both squeeze past the cap.
  perform 1 from public.event_rsvps r where r.event_id = new.event_id and r.user_id = new.user_id for update;
  if (
    select count(*) from public.event_rsvp_cars c where c.event_id = new.event_id and c.user_id = new.user_id
  ) >= 3 then
    raise exception 'You can bring up to 3 cars' using errcode = 'CZ409';
  end if;
  return new;
end;
$$;

revoke all on function private.event_rsvp_cars_before_insert() from public, anon, authenticated;

create trigger event_rsvp_cars_before_insert before insert on public.event_rsvp_cars
  for each row execute function private.event_rsvp_cars_before_insert();

-- Replace the caller's cars for an event in one step. Runs as the caller, so RLS and the checks above apply.
create function public.set_event_rsvp_cars(p_event_id uuid, p_car_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;
  if cardinality(coalesce(p_car_ids, '{}')) > 3 then
    raise exception 'You can bring up to 3 cars' using errcode = 'CZ409';
  end if;
  delete from public.event_rsvp_cars c
  where c.event_id = p_event_id and c.user_id = (select auth.uid())
    and c.car_id <> all (coalesce(p_car_ids, '{}'));
  -- Only new cars: the insert trigger counts what's already there, so re-sending one would trip the cap.
  insert into public.event_rsvp_cars (event_id, car_id)
  select p_event_id, x from unnest(coalesce(p_car_ids, '{}')) as x
  where not exists (
    select 1 from public.event_rsvp_cars c where c.event_id = p_event_id and c.car_id = x
  )
  on conflict (event_id, car_id) do nothing;
end;
$$;

revoke all on function public.set_event_rsvp_cars(uuid, uuid[]) from public, anon;
grant execute on function public.set_event_rsvp_cars(uuid, uuid[]) to authenticated;
