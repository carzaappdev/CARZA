'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useOptimistic, useState, useTransition } from 'react';
import { CheckIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { setRsvp } from '@/lib/actions/events';

export function RsvpButton({
  eventId,
  going,
  signedIn,
  full,
}: {
  eventId: string;
  going: boolean;
  signedIn: boolean;
  full: boolean;
}) {
  const router = useRouter();
  const [confirmed, setConfirmed] = useState(going);
  const [optimistic, setOptimistic] = useOptimistic(confirmed);
  const [, startTransition] = useTransition();
  const className = 'h-12 w-full rounded-xl text-base sm:w-auto sm:min-w-44';

  if (!signedIn) {
    return (
      <Button asChild size="lg" className={className}>
        <Link href={`/sign-in?next=${encodeURIComponent(`/events/${eventId}`)}` as Route}>
          RSVP
        </Link>
      </Button>
    );
  }
  if (full && !optimistic) {
    return (
      <Button size="lg" className={className} disabled>
        Event is full
      </Button>
    );
  }
  return (
    <Button
      type="button"
      size="lg"
      variant={optimistic ? 'outline' : 'default'}
      className={className}
      aria-pressed={optimistic}
      onClick={() =>
        startTransition(async () => {
          const next = !optimistic;
          setOptimistic(next);
          const result = await setRsvp({ eventId, going: next });
          if (!result.ok) {
            toast.error(result.error.message);
            return;
          }
          setConfirmed(next);
          if (next) toast.success('You’re going! See you there.');
          router.refresh();
        })
      }
    >
      {optimistic ? (
        <>
          <CheckIcon /> Going
        </>
      ) : (
        'RSVP'
      )}
    </Button>
  );
}
