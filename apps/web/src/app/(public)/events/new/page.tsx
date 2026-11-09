import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { EventForm } from '@/components/events/event-form';
import { requireUser } from '@/lib/auth';
import { getViewer } from '@/lib/viewer';
import { ZIP_COOKIE, validZip } from '@/lib/search';

export const metadata: Metadata = { title: 'Host an event' };

export default async function NewEventPage() {
  await requireUser('/events/new');
  if ((await getViewer())?.ageGroup === 'teen') {
    return (
      <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-2 px-4 py-10 sm:border-x">
        <h1 className="font-display text-2xl font-bold tracking-tight">Hosting is for adults</h1>
        <p className="text-muted-foreground">
          You need to be 18 or older to host an event on Carza. You can still RSVP to events near
          you.
        </p>
      </div>
    );
  }
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
          timezone: null,
          venueName: '',
          address: '',
          postalCode: zip,
          capacity: '',
          coverPath: null,
          adultsOnly: false,
        }}
      />
    </div>
  );
}
