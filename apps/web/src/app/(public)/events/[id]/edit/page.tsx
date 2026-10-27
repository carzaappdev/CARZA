import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { z } from 'zod';
import { getEvent } from '@carza/db';
import { eventHasEnded } from '@carza/shared';
import { EventForm } from '@/components/events/event-form';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Edit event' };

export default async function EditEventPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await requireUser(`/events/${id}/edit`);
  if (!z.guid().safeParse(id).success) notFound();
  const event = await getEvent(await createClient(), id, user.id);
  // Only the host, and only while the event can still change.
  if (!event || event.host?.id !== user.id || event.cancelled_at || eventHasEnded(event))
    notFound();

  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-6 px-4 py-6 sm:border-x md:py-10">
      <h1 className="font-display text-3xl font-bold tracking-tight">Edit event</h1>
      <EventForm
        eventId={event.id}
        initial={{
          title: event.title,
          description: event.description,
          startsAt: event.starts_at,
          endsAt: event.ends_at,
          venueName: event.venue_name,
          address: event.address ?? '',
          postalCode: event.postal_code,
          capacity: event.capacity ? String(event.capacity) : '',
          coverPath: event.cover_path,
        }}
      />
    </div>
  );
}
