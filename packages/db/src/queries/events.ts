import type { Tables, TypedClient } from '../index';
import type { PostAuthor } from './posts';

const EVENT_FIELDS = `
  id, title, description, starts_at, ends_at, timezone, venue_name, address, postal_code, city, region,
  cover_path, capacity, going_count, cancelled_at, created_at,
  host:profiles!events_host_id_fkey ( id, username, display_name, avatar_path )
` as const;

export type EventSummary = Pick<
  Tables<'events'>,
  | 'id'
  | 'title'
  | 'description'
  | 'starts_at'
  | 'ends_at'
  | 'timezone'
  | 'venue_name'
  | 'address'
  | 'postal_code'
  | 'city'
  | 'region'
  | 'cover_path'
  | 'capacity'
  | 'going_count'
  | 'cancelled_at'
  | 'created_at'
> & { host: PostAuthor | null };

/** Upcoming events, soonest first; within `radiusMiles` of a point when one is given. */
export async function getUpcomingEvents(
  client: TypedClient,
  near: { lat: number; lng: number; radiusMiles: number } | null,
): Promise<EventSummary[]> {
  const { data, error } = await client
    .rpc(
      'upcoming_events',
      near ? { p_lat: near.lat, p_lng: near.lng, p_radius_miles: near.radiusMiles } : {},
    )
    .select(EVENT_FIELDS);
  if (error) throw error;
  return data;
}

/** Events the user is going to that haven't ended, soonest first. */
export async function getMyUpcomingEvents(
  client: TypedClient,
  userId: string,
): Promise<EventSummary[]> {
  const { data, error } = await client
    .from('event_rsvps')
    .select(`event:events!inner ( ${EVENT_FIELDS} )`)
    .eq('user_id', userId)
    .is('event.cancelled_at', null)
    // An event without an end time counts as over 6 hours after it starts (same rule as the database).
    .gt('event.starts_at', new Date(Date.now() - 6 * 3_600_000).toISOString())
    .limit(100);
  if (error) throw error;
  return data.map((r) => r.event).sort((a, b) => a.starts_at.localeCompare(b.starts_at));
}

/** One event with the first attendees and whether the viewer is going. */
export async function getEvent(client: TypedClient, id: string, viewerId: string | null) {
  const { data: event, error } = await client
    .from('events')
    .select(EVENT_FIELDS)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!event) return null;

  const [attendees, mine] = await Promise.all([
    client
      .from('event_rsvps')
      .select('user:profiles!event_rsvps_user_id_fkey ( id, username, display_name, avatar_path )')
      .eq('event_id', id)
      .order('created_at', { ascending: true })
      .limit(24),
    viewerId
      ? client
          .from('event_rsvps')
          .select('event_id')
          .eq('event_id', id)
          .eq('user_id', viewerId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (attendees.error) throw attendees.error;
  if (mine.error) throw mine.error;
  return {
    ...event,
    attendees: attendees.data.flatMap((r) => (r.user ? [r.user] : [])),
    viewerGoing: mine.data !== null,
  };
}

export type EventDetail = NonNullable<Awaited<ReturnType<typeof getEvent>>>;
