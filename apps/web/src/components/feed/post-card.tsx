'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { formatRelativeTime } from '@carza/shared';
import type { PostView } from '@carza/db';
import { cn } from '@/lib/utils';
import { PostActions } from './post-actions';
import { PostMenu } from './post-menu';
import { PostPhotos } from './post-photos';
import { UserAvatar } from './user-avatar';

/**
 * One post in a list. The whole card opens the post; the author, buttons and photos sit above that link.
 * `size="lg"` is the post's own page, where the text is bigger and the card isn't a link.
 */
export function PostCard({
  post,
  viewerId,
  size = 'md',
  showReplyContext = false,
  connector = false,
  onDeleted,
}: {
  post: PostView;
  viewerId: string | null;
  size?: 'md' | 'lg';
  showReplyContext?: boolean;
  /** Draws a thread line down from the avatar (the parent above a focused post). */
  connector?: boolean;
  onDeleted?: () => void;
}) {
  const profileHref = `/u/${post.author.username}` as Route;
  const postHref = `/p/${post.id}` as Route;
  const lg = size === 'lg';
  return (
    <article
      className={cn(
        'relative flex gap-3 px-4 pt-4',
        connector ? 'pb-1' : 'pb-2',
        !connector && !lg && 'border-b',
      )}
    >
      {lg ? null : (
        <Link
          href={postHref}
          className="absolute inset-0"
          aria-label={`Open post by ${post.author.display_name}`}
        />
      )}
      <div className="flex flex-col items-center">
        <Link href={profileHref} className="relative z-10 rounded-full" tabIndex={-1} aria-hidden>
          <UserAvatar name={post.author.display_name} path={post.author.avatar_path} />
        </Link>
        {connector ? (
          <span aria-hidden className="bg-border mt-2 w-0.5 flex-1 rounded-full" />
        ) : null}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start gap-2">
          <div className="flex min-w-0 flex-1 items-baseline gap-x-1.5 text-[15px] leading-5">
            <Link
              href={profileHref}
              className="relative z-10 min-w-0 truncate font-semibold hover:underline"
            >
              {post.author.display_name}
            </Link>
            {/* On narrow screens the handle gives way first, then the name; the time always shows. */}
            <span className="text-muted-foreground min-w-0 shrink-[3] truncate">
              @{post.author.username}
            </span>
            <span className="text-muted-foreground shrink-0" aria-hidden>
              ·
            </span>
            <time
              dateTime={post.createdAt}
              className="text-muted-foreground shrink-0"
              suppressHydrationWarning
            >
              {formatRelativeTime(post.createdAt)}
            </time>
          </div>
          <PostMenu
            postId={post.id}
            author={post.author}
            viewerId={viewerId}
            onDeleted={onDeleted}
          />
        </div>
        {showReplyContext && post.replyToId ? (
          <Link
            href={`/p/${post.replyToId}` as Route}
            className="text-muted-foreground relative z-10 text-sm hover:underline"
          >
            Replying to a post
          </Link>
        ) : null}
        {post.body ? (
          <p
            className={cn(
              'mt-0.5 break-words whitespace-pre-wrap',
              lg ? 'text-[17px] leading-6' : 'text-[15px] leading-[1.4]',
            )}
          >
            {post.body}
          </p>
        ) : null}
        <PostPhotos photos={post.photos} priority={lg} />
        <div className="mt-1">
          <PostActions
            postId={post.id}
            liked={post.liked}
            likeCount={post.likeCount}
            replyCount={post.replyCount}
            signedIn={viewerId !== null}
          />
        </div>
      </div>
    </article>
  );
}
