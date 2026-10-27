'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { MessageCircleIcon, SendIcon } from 'lucide-react';
import { toast } from 'sonner';
import { formatCount } from '@carza/shared';
import { LikeButton } from './like-button';

/** Round, 44px-tall hit area around a small icon + count. */
export const actionClass =
  'relative z-10 -ml-2 inline-flex h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-2 text-sm text-muted-foreground transition-colors outline-none hover:bg-accent hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50';

async function share(postId: string) {
  const url = `${window.location.origin}/p/${postId}`;
  if (navigator.share) {
    try {
      await navigator.share({ url });
    } catch {
      // Closed the share sheet.
    }
    return;
  }
  try {
    await navigator.clipboard.writeText(url);
    toast.success('Link copied');
  } catch {
    toast.error('Couldn’t copy the link');
  }
}

export function PostActions({
  postId,
  liked,
  likeCount,
  replyCount,
  signedIn,
}: {
  postId: string;
  liked: boolean;
  likeCount: number;
  replyCount: number;
  signedIn: boolean;
}) {
  return (
    <div className="flex items-center gap-2">
      <LikeButton postId={postId} liked={liked} count={likeCount} signedIn={signedIn} />
      <Link
        href={`/p/${postId}#reply` as Route}
        className={actionClass}
        aria-label={replyCount ? `${replyCount} replies. Reply` : 'Reply'}
      >
        <MessageCircleIcon aria-hidden className="size-[18px]" />
        {replyCount > 0 ? <span className="tabular-nums">{formatCount(replyCount)}</span> : null}
      </Link>
      <button
        type="button"
        className={actionClass}
        aria-label="Share"
        onClick={() => share(postId)}
      >
        <SendIcon aria-hidden className="size-[18px]" />
      </button>
    </div>
  );
}
