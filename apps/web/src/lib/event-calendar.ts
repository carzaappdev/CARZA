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

/** schema.org Event, so search engines can list the meet. `<` is escaped so text can't close the tag. */
export function eventJsonLd(event: EventSummary, siteUrl: string, imageUrl: string | null) {
  const status = event.cancelled_at
    ? 'https://schema.org/EventCancelled'
    : 'https://schema.org/EventScheduled';
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: event.title,
    description: event.description || undefined,
    startDate: event.starts_at,
    endDate: event.ends_at ?? undefined,
    eventStatus: status,
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    url: new URL(`/events/${event.id}`, siteUrl).toString(),
    image: imageUrl ? [imageUrl] : undefined,
    location: {
      '@type': 'Place',
      name: event.venue_name,
      address: {
        '@type': 'PostalAddress',
        streetAddress: event.address ?? undefined,
        addressLocality: event.city ?? undefined,
        addressRegion: event.region ?? undefined,
        postalCode: event.postal_code,
        addressCountry: 'US',
      },
    },
    organizer: event.host
      ? {
          '@type': 'Person',
          name: event.host.display_name,
          url: new URL(`/u/${event.host.username}`, siteUrl).toString(),
        }
      : undefined,
    isAccessibleForFree: true,
  }).replace(/</g, '\\u003c');
}
