import type { Metadata, Route } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { CalendarDaysIcon, PlusIcon } from 'lucide-react';
import {
  getEventDistances,
  getHostedEvents,
  getMyUpcomingEvents,
  getNearestPostalCode,
  getPostalCode,
  getRsvpdEventIds,
  getUpcomingEvents,
  type EventSummary,
} from '@carza/db';
import { eventHasEnded, groupEventsByDay, type LatLng } from '@carza/shared';
import { EmptyState } from '@/components/feedback/empty-state';
import { EventCard } from '@/components/events/event-card';
import { ZipPicker } from '@/components/events/zip-picker';
import { Button } from '@/components/ui/button';
import { ZIP_COOKIE, validZip } from '@/lib/search';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';
import { getViewer } from '@/lib/viewer';

export const metadata: Metadata = {
  title: 'Events',
  description: 'Car meets, cruises and shows near you. Host one or RSVP in a tap.',
};

const RADII = [10, 25, 50, 100] as const;
const DEFAULT_RADIUS = 50;
const TABS = ['upcoming', 'going', 'hosting'] as const;
type Tab = (typeof TABS)[number];

type SearchParams = Record<'zip' | 'tab' | 'r' | 'lat' | 'lng', string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);

/** A device location from the URL, rounded to ~1 km so exact positions never land in links. */
function deviceLocation(params: SearchParams): LatLng | null {
  const lat = Number(one(params.lat));
  const lng = Number(one(params.lng));
  if (!one(params.lat) || !one(params.lng) || !Number.isFinite(lat) || !Number.isFinite(lng))
    return null;
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat: Math.round(lat * 100) / 100, lng: Math.round(lng * 100) / 100 };
}

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const viewer = await getViewer();
  const requested = TABS.find((t) => t === one(params.tab)) ?? 'upcoming';
  const tab: Tab = viewer ? requested : 'upcoming';
  const radius = RADII.find((r) => String(r) === one(params.r)) ?? DEFAULT_RADIUS;
  const supabase = await createClient();

  // The device's location, then a ZIP in the link, then the last one picked, then the viewer's home ZIP.
  const device = deviceLocation(params);
  const zip = device
    ? undefined
    : (validZip(one(params.zip)) ??
      validZip((await cookies()).get(ZIP_COOKIE)?.value) ??
      (viewer
        ? validZip(
            (
              await supabase
                .from('profile_private')
                .select('postal_code')
                .eq('user_id', viewer.id)
                .maybeSingle()
            ).data?.postal_code ?? undefined,
          )
        : undefined));
  const place = device
    ? await getNearestPostalCode(supabase, device)
    : zip
      ? await getPostalCode(supabase, zip)
      : null;
  const origin: LatLng | null = device ?? (place ? { lat: place.lat, lng: place.lng } : null);

  let events: EventSummary[];
  if (tab === 'going' && viewer) events = await getMyUpcomingEvents(supabase, viewer.id);
  else if (tab === 'hosting' && viewer) events = await getHostedEvents(supabase, viewer.id);
  else
    events = await getUpcomingEvents(supabase, origin ? { ...origin, radiusMiles: radius } : null);

  const [distances, going] = await Promise.all([
    origin ? getEventDistances(supabase, origin, events) : new Map<string, number>(),
    tab === 'upcoming' && viewer
      ? getRsvpdEventIds(
          supabase,
          viewer.id,
          events.map((e) => e.id),
        )
      : new Set<string>(),
  ]);

  const near = place?.city ? `${place.city}, ${place.region}` : (place?.code ?? null);
  const hostHref = (
    viewer ? '/events/new' : `/sign-in?next=${encodeURIComponent('/events/new')}`
  ) as Route;
  const tabHref = (key: Tab) => {
    if (key === 'upcoming') return '/events';
    const href = `/events?tab=${key}`;
    return viewer ? href : `/sign-in?next=${encodeURIComponent(href)}`;
  };
  // Keeps the chosen place when the radius changes.
  const radiusHref = (r: number) => {
    const q = new URLSearchParams();
    if (device) {
      q.set('lat', String(device.lat));
      q.set('lng', String(device.lng));
    } else if (zip) q.set('zip', zip);
    if (r !== DEFAULT_RADIUS) q.set('r', String(r));
    const s = q.toString();
    return (s ? `/events?${s}` : '/events') as Route;
  };

  const card = (event: EventSummary) => (
    <li key={event.id}>
      <EventCard
        event={event}
        distanceMiles={tab === 'going' || tab === 'upcoming' ? distances.get(event.id) : undefined}
        going={tab === 'going' || going.has(event.id)}
      />
    </li>
  );

  const hostedUpcoming = tab === 'hosting' ? events.filter((e) => !eventHasEnded(e)).reverse() : [];
  const hostedPast = tab === 'hosting' ? events.filter((e) => eventHasEnded(e)) : [];

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col sm:border-x">
      <header className="flex flex-col gap-3 px-4 pt-6 pb-3">
        <div className="flex items-center justify-between gap-3">
          <h1 className="font-display text-3xl font-bold tracking-tight">Events</h1>
          <Button asChild className="rounded-full">
            <Link href={hostHref}>
              <PlusIcon /> Host
            </Link>
          </Button>
        </div>
        {tab === 'upcoming' ? (
          <div className="flex flex-wrap items-center gap-2">
            <ZipPicker
              label={near ? `Near ${near}` : 'Everywhere · set your ZIP'}
              zip={zip ?? null}
            />
            {origin ? (
              <nav aria-label="Distance" className="flex gap-1">
                {RADII.map((r) => (
                  <Link
                    key={r}
                    href={radiusHref(r)}
                    aria-current={r === radius ? 'true' : undefined}
                    className={cn(
                      'focus-visible:ring-ring/50 inline-flex h-9 items-center rounded-full border px-3 text-sm font-medium outline-none focus-visible:ring-[3px]',
                      r === radius
                        ? 'bg-foreground text-background border-foreground'
                        : 'text-muted-foreground hover:text-foreground hover:bg-accent',
                    )}
                  >
                    {r} mi
                  </Link>
                ))}
              </nav>
            ) : null}
          </div>
        ) : null}
      </header>

      <nav aria-label="Event lists" className="grid grid-cols-3 border-b">
        {(
          [
            ['upcoming', 'Upcoming'],
            ['going', 'Going'],
            ['hosting', 'Hosting'],
          ] as const
        ).map(([key, label]) => (
          <Link
            key={key}
            href={tabHref(key) as Route}
            aria-current={tab === key ? 'page' : undefined}
            className={cn(
              'focus-visible:ring-ring/50 relative flex h-12 items-center justify-center text-[15px] font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-inset',
              tab === key ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {label}
            {tab === key ? (
              <span aria-hidden className="bg-foreground absolute inset-x-0 bottom-0 h-0.5" />
            ) : null}
          </Link>
        ))}
      </nav>

      <div className="flex flex-col gap-6 p-4">
        {events.length === 0 ? (
          <EmptyState
            Icon={CalendarDaysIcon}
            title={
              tab === 'going'
                ? 'No plans yet'
                : tab === 'hosting'
                  ? 'You haven’t hosted anything yet'
                  : near
                    ? `Nothing within ${radius} miles of ${near}`
                    : 'No events yet'
            }
            body={
              tab === 'going'
                ? 'RSVP to an event and it shows up here.'
                : tab === 'upcoming' && near && radius < 100
                  ? 'Try a wider radius, or be the one who gets everyone together.'
                  : 'Be the one who gets everyone together. Host a meet, a cruise or a show.'
            }
            action={
              <Button asChild className="rounded-full">
                <Link href={tab === 'going' ? '/events' : hostHref}>
                  {tab === 'going' ? 'Find events' : 'Host an event'}
                </Link>
              </Button>
            }
          />
        ) : tab === 'hosting' ? (
          (
            [
              ['Coming up', hostedUpcoming],
              ['Past', hostedPast],
            ] as const
          ).map(([label, list]) =>
            list.length ? (
              <DaySection key={label} label={label}>
                {list.map(card)}
              </DaySection>
            ) : null,
          )
        ) : (
          groupEventsByDay(events).map((group, i) => (
            <DaySection key={`${i}-${group.label}`} label={group.label}>
              {group.events.map(card)}
            </DaySection>
          ))
        )}
      </div>
    </div>
  );
}

function DaySection({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-muted-foreground text-sm font-semibold tracking-wide uppercase">
        {label}
      </h2>
      <ul className="flex flex-col gap-4">{children}</ul>
    </section>
  );
}
