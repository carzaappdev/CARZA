import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { ClockIcon, MapPinIcon, UsersIcon } from 'lucide-react';
import { z } from 'zod';
import { getEvent } from '@carza/db';
import { eventHasEnded, formatCount, formatEventWhen } from '@carza/shared';
import { DateBadge } from '@/components/events/event-card';
import { EventCover } from '@/components/events/event-cover';
import { HostMenu } from '@/components/events/host-menu';
import { RsvpButton } from '@/components/events/rsvp-button';
import { UserAvatar } from '@/components/feed/user-avatar';
import { SafetyMenu } from '@/components/safety/safety-menu';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

type Props = { params: Promise<{ id: string }> };

const loadEvent = cache(async (id: string) => {
  if (!z.guid().safeParse(id).success) return null;
  const user = await getUser();
  return getEvent(await createClient(), id, user?.id ?? null);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const event = await loadEvent((await params).id);
  if (!event) return { title: 'Event not found' };
  return {
    title: event.title,
    description: `${formatEventWhen(event.starts_at, event.ends_at, event.timezone)} · ${event.venue_name}${event.city ? `, ${event.city}` : ''}`,
  };
}

export default async function EventPage({ params }: Props) {
  const { id } = await params;
  const event = await loadEvent(id);
  if (!event) notFound();

  const user = await getUser();
  const isHost = user?.id === event.host?.id;
  const ended = eventHasEnded(event);
  const cancelled = event.cancelled_at !== null;
  const full = event.capacity !== null && event.going_count >= event.capacity;
  const where = [
    event.address,
    event.city && event.region
      ? `${event.city}, ${event.region} ${event.postal_code}`
      : event.postal_code,
  ]
    .filter(Boolean)
    .join(', ');
  const mapsHref = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${event.venue_name}, ${where}`)}`;

  return (
    <div className="mx-auto w-full max-w-[640px] flex-1 sm:border-x">
      {event.cover_path ? (
        <EventCover path={event.cover_path} sizes="(min-width: 640px) 640px, 100vw" priority />
      ) : null}
      <div className="flex flex-col gap-5 px-4 pt-6 pb-10">
        {cancelled ? (
          <p className="bg-destructive/10 text-destructive rounded-xl px-4 py-3 text-sm font-semibold">
            This event was cancelled.
          </p>
        ) : ended ? (
          <p className="bg-muted rounded-xl px-4 py-3 text-sm font-semibold">
            This event has ended.
          </p>
        ) : null}

        <div className="flex gap-3">
          <DateBadge startsAt={event.starts_at} timezone={event.timezone} />
          <h1 className="font-display self-center text-2xl leading-tight font-bold tracking-tight sm:text-3xl">
            {event.title}
          </h1>
        </div>

        <ul className="flex flex-col gap-3 text-[15px]">
          <li className="flex gap-3">
            <ClockIcon className="text-muted-foreground mt-0.5 size-5 shrink-0" aria-hidden />
            {formatEventWhen(event.starts_at, event.ends_at, event.timezone)}
          </li>
          <li className="flex gap-3">
            <MapPinIcon className="text-muted-foreground mt-0.5 size-5 shrink-0" aria-hidden />
            <span>
              <span className="font-semibold">{event.venue_name}</span>
              <br />
              <a
                href={mapsHref}
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground underline-offset-4 hover:underline"
              >
                {where}
              </a>
            </span>
          </li>
          <li className="flex gap-3">
            <UsersIcon className="text-muted-foreground mt-0.5 size-5 shrink-0" aria-hidden />
            <span>
              {formatCount(event.going_count)} going
              {event.capacity ? (
                <span className="text-muted-foreground">
                  {' '}
                  ·{' '}
                  {full ? 'full' : `${formatCount(event.capacity - event.going_count)} spots left`}
                </span>
              ) : null}
            </span>
          </li>
        </ul>

        {!cancelled && !ended ? (
          <div className="flex gap-2">
            {isHost ? (
              <>
                <p className="bg-muted flex h-12 flex-1 items-center justify-center rounded-xl text-sm font-semibold sm:flex-none sm:px-6">
                  You’re hosting
                </p>
                <HostMenu eventId={event.id} />
              </>
            ) : (
              <RsvpButton
                eventId={event.id}
                going={event.viewerGoing}
                signedIn={user !== null}
                full={full}
              />
            )}
          </div>
        ) : null}

        {event.host ? (
          <div className="-mx-2 flex items-center gap-1">
            <Link
              href={`/u/${event.host.username}` as Route}
              className="hover:bg-accent/60 focus-visible:ring-ring/50 flex min-w-0 flex-1 items-center gap-3 rounded-xl p-2 outline-none focus-visible:ring-[3px]"
            >
              <UserAvatar
                name={event.host.display_name}
                path={event.host.avatar_path}
                className="size-11"
              />
              <span className="min-w-0">
                <span className="text-muted-foreground block text-xs font-medium tracking-wide uppercase">
                  Hosted by
                </span>
                <span className="block truncate font-semibold">{event.host.display_name}</span>
              </span>
            </Link>
            <SafetyMenu
              targetType="event"
              targetId={event.id}
              owner={event.host}
              viewerId={user?.id ?? null}
            />
          </div>
        ) : null}

        {event.description ? (
          <section aria-labelledby="about-heading" className="flex flex-col gap-2">
            <h2 id="about-heading" className="font-display text-lg font-bold">
              About
            </h2>
            <p className="text-[15px] leading-[1.5] break-words whitespace-pre-wrap">
              {event.description}
            </p>
          </section>
        ) : null}

        {event.attendees.length > 0 ? (
          <section aria-labelledby="going-heading" className="flex flex-col gap-3">
            <h2 id="going-heading" className="font-display text-lg font-bold">
              Who’s going
            </h2>
            <ul className="flex flex-wrap gap-3">
              {event.attendees.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/u/${a.username}` as Route}
                    className="focus-visible:ring-ring/50 flex w-16 flex-col items-center gap-1 rounded-lg outline-none focus-visible:ring-[3px]"
                  >
                    <UserAvatar name={a.display_name} path={a.avatar_path} className="size-12" />
                    <span className="text-muted-foreground w-full truncate text-center text-xs">
                      {a.display_name.split(' ')[0]}
                    </span>
                  </Link>
                </li>
              ))}
              {event.going_count > event.attendees.length ? (
                <li className="text-muted-foreground grid size-12 place-items-center rounded-full border text-xs font-semibold">
                  +{formatCount(event.going_count - event.attendees.length)}
                </li>
              ) : null}
            </ul>
          </section>
        ) : null}
      </div>
    </div>
  );
}
