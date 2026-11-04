import type { Route } from 'next';
import Link from 'next/link';
import { CheckIcon, MapPinIcon, UsersIcon } from 'lucide-react';
import type { EventSummary } from '@carza/db';
import { eventDateBadge, eventHasEnded, formatCount, formatEventWhen } from '@carza/shared';
import { cn } from '@/lib/utils';
import { EventCover } from './event-cover';

export function DateBadge({ startsAt, timezone }: { startsAt: string; timezone: string }) {
  const { month, day } = eventDateBadge(startsAt, timezone);
  return (
    <div className="bg-background flex w-12 shrink-0 flex-col items-center self-start overflow-hidden rounded-xl border text-center shadow-sm">
      <span className="w-full bg-rose-600 py-0.5 text-[10px] font-bold tracking-wider text-white">
        {month}
      </span>
      <span className="font-display py-0.5 text-xl leading-7 font-bold">{day}</span>
    </div>
  );
}

/** "3 mi", "25 mi", "<1 mi". */
const formatMiles = (miles: number) => (miles < 1 ? '<1 mi' : `${Math.round(miles)} mi`);

export function EventCard({
  event,
  distanceMiles,
  going = false,
}: {
  event: EventSummary;
  distanceMiles?: number;
  going?: boolean;
}) {
  const place = [event.venue_name, event.city].filter(Boolean).join(' · ');
  const cancelled = event.cancelled_at !== null;
  const ended = !cancelled && eventHasEnded(event);
  const spotsLeft =
    event.capacity === null ? null : Math.max(event.capacity - event.going_count, 0);
  const status = cancelled
    ? { text: 'Cancelled', className: 'bg-destructive/10 text-destructive' }
    : ended
      ? { text: 'Ended', className: 'bg-muted text-muted-foreground' }
      : going
        ? { text: 'Going', className: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400' }
        : spotsLeft === 0
          ? { text: 'Full', className: 'bg-muted text-muted-foreground' }
          : null;

  return (
    <Link
      href={`/events/${event.id}` as Route}
      className={cn(
        'group bg-card focus-visible:ring-ring/50 flex flex-col overflow-hidden rounded-2xl border outline-none focus-visible:ring-[3px]',
        (cancelled || ended) && 'opacity-75',
      )}
    >
      {event.cover_path ? (
        <EventCover path={event.cover_path} sizes="(min-width: 640px) 600px, 100vw" />
      ) : null}
      <div className="flex gap-3 p-4">
        <DateBadge startsAt={event.starts_at} timezone={event.timezone} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start gap-2">
            <h3
              className={cn(
                'font-display line-clamp-2 min-w-0 flex-1 text-lg leading-6 font-bold break-words group-hover:underline',
                cancelled && 'line-through',
              )}
            >
              {event.title}
            </h3>
            {status ? (
              <span
                className={cn(
                  'inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2 text-xs font-semibold',
                  status.className,
                )}
              >
                {status.text === 'Going' ? <CheckIcon className="size-3.5" aria-hidden /> : null}
                {status.text}
              </span>
            ) : null}
          </div>
          <p className="text-muted-foreground mt-0.5 text-sm">
            {formatEventWhen(event.starts_at, event.ends_at, event.timezone)}
          </p>
          <div className="text-muted-foreground mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span className="flex min-w-0 items-center gap-1.5">
              <MapPinIcon className="size-4 shrink-0" aria-hidden />
              <span className="truncate">{place}</span>
              {distanceMiles !== undefined ? (
                <span className="shrink-0">· {formatMiles(distanceMiles)}</span>
              ) : null}
            </span>
            <span className="flex items-center gap-1.5">
              <UsersIcon className="size-4 shrink-0" aria-hidden />
              {formatCount(event.going_count)} going
              {spotsLeft !== null && spotsLeft > 0 && spotsLeft <= 10 && !cancelled && !ended ? (
                <span className="font-medium text-amber-700 dark:text-amber-400">
                  · {spotsLeft} {spotsLeft === 1 ? 'spot' : 'spots'} left
                </span>
              ) : null}
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
