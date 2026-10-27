'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useOptimistic, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { setFollowing } from '@/lib/actions/follows';

export function FollowButton({
  userId,
  following,
  signedIn,
  className,
}: {
  userId: string;
  following: boolean;
  signedIn: boolean;
  className?: string;
}) {
  const pathname = usePathname();
  const [confirmed, setConfirmed] = useState(following);
  const [optimistic, setOptimistic] = useOptimistic(confirmed);
  const [, startTransition] = useTransition();

  if (!signedIn) {
    return (
      <Button asChild className={className}>
        <Link href={`/sign-in?next=${encodeURIComponent(pathname)}` as Route}>Follow</Link>
      </Button>
    );
  }
  return (
    <Button
      type="button"
      variant={optimistic ? 'outline' : 'default'}
      className={className}
      aria-pressed={optimistic}
      onClick={() =>
        startTransition(async () => {
          const next = !optimistic;
          setOptimistic(next);
          const result = await setFollowing({ userId, following: next });
          if (!result.ok) {
            toast.error(result.error.message);
            return;
          }
          setConfirmed(next);
        })
      }
    >
      {optimistic ? 'Following' : 'Follow'}
    </Button>
  );
}
