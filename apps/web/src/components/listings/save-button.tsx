'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useOptimistic, useState, useTransition } from 'react';
import { HeartIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { setListingSaved } from '@/lib/actions/saved-listings';
import { cn } from '@/lib/utils';

/**
 * The heart. Signed-out buyers are sent to sign in and brought back. `overlay` is the round button on
 * listing photos; `button` is the labelled one on the listing page.
 */
export function SaveButton({
  listingId,
  saved,
  signedIn,
  variant = 'overlay',
  className,
}: {
  listingId: string;
  saved: boolean;
  signedIn: boolean;
  variant?: 'overlay' | 'button';
  className?: string;
}) {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [confirmed, setConfirmed] = useState(saved);
  const [optimistic, setOptimistic] = useOptimistic(confirmed);
  const [, startTransition] = useTransition();
  const label = optimistic ? 'Saved' : 'Save';
  const overlay = variant === 'overlay';
  const classes = cn(
    overlay &&
      'bg-background/90 text-foreground hover:bg-background rounded-full shadow-sm backdrop-blur',
    className,
  );
  const icon = (
    <HeartIcon
      aria-hidden
      className={cn('size-5 transition-transform', optimistic && 'fill-red-500 text-red-500')}
    />
  );

  if (!signedIn) {
    const next = `${pathname}${search ? `?${search}` : ''}`;
    return (
      <Button
        asChild
        variant={overlay ? 'ghost' : 'outline'}
        size={overlay ? 'icon' : 'default'}
        className={classes}
      >
        <Link
          href={`/sign-in?next=${encodeURIComponent(next)}` as Route}
          aria-label={overlay ? 'Sign in to save this car' : undefined}
        >
          {icon}
          {!overlay && 'Save'}
        </Link>
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant={overlay ? 'ghost' : 'outline'}
      size={overlay ? 'icon' : 'default'}
      className={classes}
      aria-pressed={optimistic}
      aria-label={overlay ? (optimistic ? 'Remove from saved cars' : 'Save this car') : undefined}
      onClick={() =>
        startTransition(async () => {
          const next = !optimistic;
          setOptimistic(next);
          const result = await setListingSaved({ listingId, saved: next });
          if (!result.ok) {
            toast.error(result.error.message);
            return;
          }
          setConfirmed(next);
          if (next) toast.success('Saved. Find it under Account → Saved.');
        })
      }
    >
      {icon}
      {!overlay && label}
    </Button>
  );
}
