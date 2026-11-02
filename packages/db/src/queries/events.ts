import { distanceMiles, type LatLng } from '@carza/shared';
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

/** Events the user hosts, newest start first: upcoming, past and cancelled. */
export async function getHostedEvents(
  client: TypedClient,
  userId: string,
): Promise<EventSummary[]> {
  const { data, error } = await client
    .from('events')
    .select(EVENT_FIELDS)
    .eq('host_id', userId)
    .order('starts_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return data;
}

/** Which of `eventIds` the user is going to. */
export async function getRsvpdEventIds(client: TypedClient, userId: string, eventIds: string[]) {
  if (!eventIds.length) return new Set<string>();
  const { data, error } = await client
    .from('event_rsvps')
    .select('event_id')
    .eq('user_id', userId)
    .in('event_id', eventIds);
  if (error) throw error;
  return new Set(data.map((r) => r.event_id));
}

/** Miles from `from` to each event's ZIP centroid (the same point "near you" searches use). */
export async function getEventDistances(
  client: TypedClient,
  from: LatLng,
  events: Pick<EventSummary, 'id' | 'postal_code'>[],
) {
  const codes = [...new Set(events.map((e) => e.postal_code))];
  const out = new Map<string, number>();
  if (!codes.length) return out;
  const { data, error } = await client
    .from('postal_codes')
    .select('code, lat, lng')
    .in('code', codes);
  if (error) throw error;
  const points = new Map(data.map((p) => [p.code, p]));
  for (const e of events) {
    const p = points.get(e.postal_code);
    if (p) out.set(e.id, distanceMiles(from, p));
  }
  return out;
}

/** The ZIP whose centroid is closest to a point (within ~70 miles), for "Near Austin, TX" labels. */
export async function getNearestPostalCode(client: TypedClient, at: LatLng) {
  for (const box of [0.15, 1]) {
    const { data, error } = await client
      .from('postal_codes')
      .select('code, city, region, lat, lng')
      .gte('lat', at.lat - box)
      .lte('lat', at.lat + box)
      .gte('lng', at.lng - box * 1.3)
      .lte('lng', at.lng + box * 1.3)
      .limit(1000);
    if (error) throw error;
    if (data.length) {
      return data.reduce((best, p) => (distanceMiles(at, p) < distanceMiles(at, best) ? p : best));
    }
  }
  return null;
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
    friendsGoing: viewerId ? await getFriendsGoing(client, id, viewerId) : [],
  };
}

/** People the viewer follows who are going (up to 500 guests checked, which covers any meet). */
async function getFriendsGoing(client: TypedClient, eventId: string, viewerId: string) {
  const { data: guests, error } = await client
    .from('event_rsvps')
    .select('user_id')
    .eq('event_id', eventId)
    .neq('user_id', viewerId)
    .limit(500);
  if (error) throw error;
  if (!guests.length) return [];
  const { data, error: fErr } = await client
    .from('follows')
    .select(
      'followee:profiles!follows_followee_id_fkey ( id, username, display_name, avatar_path )',
    )
    .eq('follower_id', viewerId)
    .in(
      'followee_id',
      guests.map((g) => g.user_id),
    )
    .limit(20);
  if (fErr) throw fErr;
  return data.flatMap((f): PostAuthor[] => (f.followee ? [f.followee] : []));
}

export type EventDetail = NonNullable<Awaited<ReturnType<typeof getEvent>>>;
