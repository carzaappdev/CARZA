import type { EventSummary } from '@carza/db';
import type { CalendarEvent } from '@carza/shared';

/** The fields calendars need, from an event row. */
export function eventCalendarInfo(event: EventSummary, siteUrl: string): CalendarEvent {
  const place = [
    event.venue_name,
    event.address,
    event.city && event.region
      ? `${event.city}, ${event.region} ${event.postal_code}`
      : event.postal_code,
  ]
    .filter(Boolean)
    .join(', ');
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    startsAt: event.starts_at,
    endsAt: event.ends_at,
    location: place,
    url: new URL(`/events/${event.id}`, siteUrl).toString(),
  };
}
