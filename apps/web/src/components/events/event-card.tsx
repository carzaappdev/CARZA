import type { Route } from 'next';
import Link from 'next/link';
import { MapPinIcon, UsersIcon } from 'lucide-react';
import type { EventSummary } from '@carza/db';
import { eventDateBadge, formatCount, formatEventWhen } from '@carza/shared';
import { EventCover } from './event-cover';

export function DateBadge({ startsAt, timezone }: { startsAt: string; timezone: string }) {
  const { month, day } = eventDateBadge(startsAt, timezone);
  return (
    <div className="bg-background flex w-12 shrink-0 flex-col self-start items-center overflow-hidden rounded-xl border text-center shadow-sm">
      <span className="bg-rose-600 w-full py-0.5 text-[10px] font-bold tracking-wider text-white">
        {month}
      </span>
      <span className="font-display py-0.5 text-xl leading-7 font-bold">{day}</span>
    </div>
  );
}

export function EventCard({ event }: { event: EventSummary }) {
  const place = [event.venue_name, event.city].filter(Boolean).join(' · ');
  return (
    <Link
      href={`/events/${event.id}` as Route}
      className="group bg-card focus-visible:ring-ring/50 flex flex-col overflow-hidden rounded-2xl border outline-none focus-visible:ring-[3px]"
    >
      {event.cover_path ? (
        <EventCover path={event.cover_path} sizes="(min-width: 640px) 600px, 100vw" />
      ) : null}
      <div className="flex gap-3 p-4">
        <DateBadge startsAt={event.starts_at} timezone={event.timezone} />
        <div className="min-w-0 flex-1">
          <h3 className="font-display truncate text-lg leading-6 font-bold group-hover:underline">
            {event.title}
          </h3>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {formatEventWhen(event.starts_at, event.ends_at, event.timezone)}
          </p>
          <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="flex min-w-0 items-center gap-1.5">
              <MapPinIcon className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{place}</span>
            </span>
            <span className="flex items-center gap-1.5">
              <UsersIcon className="size-4 shrink-0" aria-hidden />
              {formatCount(event.going_count)} going
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
