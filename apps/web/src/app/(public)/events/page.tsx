import type { Metadata, Route } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { CalendarDaysIcon, PlusIcon } from 'lucide-react';
import { getMyUpcomingEvents, getPostalCode, getUpcomingEvents } from '@carza/db';
import { EmptyState } from '@/components/feedback/empty-state';
import { EventCard } from '@/components/events/event-card';
import { ZipPicker } from '@/components/events/zip-picker';
import { Button } from '@/components/ui/button';
import { ZIP_COOKIE, validZip } from '@/lib/search';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';
import { getViewer } from '@/lib/viewer';

export const metadata: Metadata = { title: 'Events' };

const RADIUS_MILES = 50;

export default async function EventsPage({
  searchParams,
}: {
  searchParams: Promise<{ zip?: string | string[]; tab?: string | string[] }>;
}) {
  const params = await searchParams;
  const viewer = await getViewer();
  const tab = params.tab === 'going' && viewer ? 'going' : 'upcoming';
  const supabase = await createClient();

  // A ZIP in the link, then the last one picked, then the viewer's home ZIP.
  const zip =
    validZip(typeof params.zip === 'string' ? params.zip : undefined) ??
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
      : undefined);
  const postal = zip ? await getPostalCode(supabase, zip) : null;
  const events =
    tab === 'going' && viewer
      ? await getMyUpcomingEvents(supabase, viewer.id)
      : await getUpcomingEvents(
          supabase,
          postal ? { lat: postal.lat, lng: postal.lng, radiusMiles: RADIUS_MILES } : null,
        );
  const near = postal ? (postal.city ? `${postal.city}, ${postal.region}` : postal.code) : null;
  const hostHref = (
    viewer ? '/events/new' : `/sign-in?next=${encodeURIComponent('/events/new')}`
  ) as Route;
  const goingHref = viewer
    ? '/events?tab=going'
    : `/sign-in?next=${encodeURIComponent('/events?tab=going')}`;

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
          <div>
            <ZipPicker
              label={near ? `Near ${near}` : 'Everywhere · set your ZIP'}
              zip={zip ?? null}
            />
          </div>
        ) : null}
      </header>

      <nav aria-label="Event lists" className="grid grid-cols-2 border-b">
        {(
          [
            ['upcoming', 'Upcoming', '/events'],
            ['going', 'Going', goingHref],
          ] as const
        ).map(([key, label, href]) => (
          <Link
            key={key}
            href={href as Route}
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

      <div className="flex flex-col gap-4 p-4">
        {events.length > 0 ? (
          <ul className="flex flex-col gap-4">
            {events.map((event) => (
              <li key={event.id}>
                <EventCard event={event} />
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState
            Icon={CalendarDaysIcon}
            title={
              tab === 'going'
                ? 'No plans yet'
                : near
                  ? `Nothing coming up near ${near}`
                  : 'No events yet'
            }
            body={
              tab === 'going'
                ? 'RSVP to an event and it shows up here.'
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
        )}
      </div>
    </div>
  );
}
