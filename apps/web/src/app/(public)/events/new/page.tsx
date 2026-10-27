import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { EventForm } from '@/components/events/event-form';
import { requireUser } from '@/lib/auth';
import { ZIP_COOKIE, validZip } from '@/lib/search';

export const metadata: Metadata = { title: 'Host an event' };

export default async function NewEventPage() {
  await requireUser('/events/new');
  const zip = validZip((await cookies()).get(ZIP_COOKIE)?.value) ?? '';
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-6 px-4 py-6 sm:border-x md:py-10">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-bold tracking-tight">Host an event</h1>
        <p className="text-muted-foreground">A meet, a cruise, a show. Anyone nearby can RSVP.</p>
      </div>
      <EventForm
        initial={{
          title: '',
          description: '',
          startsAt: null,
          endsAt: null,
          venueName: '',
          address: '',
          postalCode: zip,
          capacity: '',
          coverPath: null,
        }}
      />
    </div>
  );
}
