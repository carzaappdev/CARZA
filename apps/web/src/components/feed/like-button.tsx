'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useOptimistic, useState, useTransition } from 'react';
import { HeartIcon } from 'lucide-react';
import { toast } from 'sonner';
import { formatCount } from '@carza/shared';
import { setPostLiked } from '@/lib/actions/posts';
import { cn } from '@/lib/utils';
import { actionClass } from './post-actions';

export function LikeButton({
  postId,
  liked,
  count,
  signedIn,
}: {
  postId: string;
  liked: boolean;
  count: number;
  signedIn: boolean;
}) {
  const [confirmed, setConfirmed] = useState({ liked, count });
  const [optimistic, setOptimistic] = useOptimistic(confirmed);
  const [, startTransition] = useTransition();
  const content = (
    <>
      <HeartIcon
        aria-hidden
        className={cn(
          'size-[18px] transition-transform duration-150',
          optimistic.liked && 'scale-110 fill-rose-500 text-rose-500',
        )}
      />
      {optimistic.count > 0 ? (
        <span className={cn('tabular-nums', optimistic.liked && 'text-rose-500')}>
          {formatCount(optimistic.count)}
        </span>
      ) : null}
    </>
  );

  if (!signedIn) {
    return (
      <Link
        href={`/sign-in?next=${encodeURIComponent(`/p/${postId}`)}` as Route}
        className={actionClass}
        aria-label="Sign in to like"
      >
        {content}
      </Link>
    );
  }

  return (
    <button
      type="button"
      className={actionClass}
      aria-pressed={optimistic.liked}
      aria-label={optimistic.liked ? 'Unlike' : 'Like'}
      onClick={() =>
        startTransition(async () => {
          const next = {
            liked: !optimistic.liked,
            count: Math.max(0, optimistic.count + (optimistic.liked ? -1 : 1)),
          };
          setOptimistic(next);
          const result = await setPostLiked({ postId, liked: next.liked });
          if (!result.ok) {
            toast.error(result.error.message);
            return;
          }
          setConfirmed(next);
        })
      }
    >
      {content}
    </button>
  );
}
