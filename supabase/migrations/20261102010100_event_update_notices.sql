-- When a host moves an event (time or place), everyone going gets one notification, and the day-before
-- reminder is re-armed so it fires for the new time.

-- Re-arm the reminder when the start time moves.
create function private.events_rearm_reminder()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.starts_at is distinct from old.starts_at then
    new.reminded_at := null;
  end if;
  return new;
end;
$$;

-- One unread "changed" notice per guest per event: a second edit replaces the first instead of stacking.
create function private.notify_on_event_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.cancelled_at is not null then
    return null;
  end if;
  if (new.starts_at, new.ends_at, new.venue_name, new.address, new.postal_code)
     is not distinct from
     (old.starts_at, old.ends_at, old.venue_name, old.address, old.postal_code) then
    return null;
  end if;

  delete from public.notifications n
  where n.user_id in (select r.user_id from public.event_rsvps r where r.event_id = new.id)
    and n.type = 'event_updated' and n.read_at is null and n.data ->> 'event_id' = new.id::text;

  insert into public.notifications (user_id, type, data)
  select r.user_id, 'event_updated', jsonb_build_object(
    'actor_id', new.host_id, 'event_id', new.id, 'snippet', private.snippet(new.title)
  )
  from public.event_rsvps r
  where r.event_id = new.id and r.user_id <> new.host_id;
  return null;
end;
$$;

revoke all on function private.events_rearm_reminder(), private.notify_on_event_change()
  from public, anon, authenticated;

create trigger events_rearm_reminder before update of starts_at on public.events
  for each row execute function private.events_rearm_reminder();
create trigger events_notify_change
  after update of starts_at, ends_at, venue_name, address, postal_code on public.events
  for each row execute function private.notify_on_event_change();
