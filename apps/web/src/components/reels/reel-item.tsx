'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useOptimistic, useRef, useState, useTransition } from 'react';
import { HeartIcon, MoreHorizontalIcon, PlayIcon, SendIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import type { ReelView } from '@carza/db';
import { formatCount } from '@carza/shared';
import { UserAvatar } from '@/components/feed/user-avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { deleteReel, setReelLiked } from '@/lib/actions/reels';
import { publicStorageUrl } from '@/lib/storage';
import { cn } from '@/lib/utils';

const railButton =
  'flex flex-col items-center gap-1 text-xs font-semibold text-white outline-none focus-visible:[&>span:first-child]:ring-[3px] focus-visible:[&>span:first-child]:ring-white/60';
const railIcon = 'grid size-12 place-items-center rounded-full bg-black/30 backdrop-blur';

export function ReelItem({
  reel,
  viewerId,
  active,
  mounted,
  muted,
  onDeleted,
}: {
  reel: ReelView;
  viewerId: string | null;
  active: boolean;
  mounted: boolean;
  muted: boolean;
  onDeleted: () => void;
}) {
  const router = useRouter();
  const video = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const [like, setLike] = useState({ liked: reel.liked, count: reel.likeCount });
  const [optimistic, setOptimistic] = useOptimistic(like);
  const [, startTransition] = useTransition();
  const [burst, setBurst] = useState(0);
  // Vertical clips fill the screen; landscape ones are letterboxed rather than cropped.
  const fit = reel.height >= reel.width ? 'object-cover' : 'object-contain';
  const poster = publicStorageUrl('reels', reel.posterPath);

  // Play the reel on screen from the start; stop the others.
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    if (active) {
      el.currentTime = 0;
      // onPlay/onPause keep `paused` in sync; if autoplay is blocked, show the play button.
      el.play().catch(() => setPaused(true));
    } else {
      el.pause();
    }
  }, [active, mounted]);

  function toggleLike(force?: boolean) {
    if (!viewerId) {
      router.push(`/sign-in?next=${encodeURIComponent(`/reels/${reel.id}`)}` as Route);
      return;
    }
    const liked = force ?? !optimistic.liked;
    if (liked === optimistic.liked) return;
    startTransition(async () => {
      const next = { liked, count: Math.max(0, optimistic.count + (liked ? 1 : -1)) };
      setOptimistic(next);
      const result = await setReelLiked({ reelId: reel.id, liked });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setLike(next);
    });
  }

  async function share() {
    const url = `${window.location.origin}/reels/${reel.id}`;
    try {
      if (navigator.share) await navigator.share({ url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success('Link copied');
      }
    } catch {
      // Closed the share sheet.
    }
  }

  return (
    <div className="absolute inset-0 overflow-hidden bg-black">
      {/* The poster shows instantly and stays under the video until it has frames. */}
      {/* eslint-disable-next-line @next/next/no-img-element -- full-bleed poster; next/image adds no value here */}
      <img src={poster} alt="" className={cn('absolute inset-0 size-full', fit)} />
      {mounted ? (
        <video
          ref={video}
          src={publicStorageUrl('reels', reel.videoPath)}
          poster={poster}
          muted={muted}
          loop
          playsInline
          preload={active ? 'auto' : 'metadata'}
          className={cn('absolute inset-0 size-full', fit)}
          onPlay={() => setPaused(false)}
          onPause={() => setPaused(true)}
        />
      ) : null}

      {/* Tap to pause/play; double-tap to like. */}
      <button
        type="button"
        aria-label={paused ? 'Play' : 'Pause'}
        className="absolute inset-0 outline-none"
        onClick={() => {
          const el = video.current;
          if (!el) return;
          if (el.paused) void el.play();
          else el.pause();
        }}
        onDoubleClick={() => {
          const key = Date.now();
          setBurst(key);
          setTimeout(() => setBurst((b) => (b === key ? 0 : b)), 700);
          toggleLike(true);
        }}
      />
      {paused && active ? (
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="grid size-16 place-items-center rounded-full bg-black/40 backdrop-blur">
            <PlayIcon className="size-8 fill-white text-white" aria-hidden />
          </span>
        </span>
      ) : null}
      {burst ? (
        <HeartIcon
          key={burst}
          aria-hidden
          className="animate-in zoom-in-50 fade-in pointer-events-none absolute top-1/2 left-1/2 size-24 -translate-x-1/2 -translate-y-1/2 fill-white text-white drop-shadow-lg duration-300"
        />
      ) : null}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 to-transparent" />

      <div className="absolute right-0 bottom-0 left-0 flex items-end gap-3 p-4 pb-5">
        <div className="min-w-0 flex-1 text-white">
          <Link
            href={`/u/${reel.author.username}` as Route}
            className="relative inline-flex max-w-full items-center gap-2 rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-white/60"
          >
            <UserAvatar
              name={reel.author.display_name}
              path={reel.author.avatar_path}
              className="size-8 ring-2 ring-white/80"
            />
            <span className="truncate font-semibold drop-shadow">{reel.author.display_name}</span>
          </Link>
          {reel.caption ? (
            <p className="mt-2 line-clamp-3 text-[15px] leading-snug break-words whitespace-pre-wrap drop-shadow">
              {reel.caption}
            </p>
          ) : null}
        </div>

        <div className="relative flex flex-col items-center gap-4">
          <button
            type="button"
            className={railButton}
            aria-pressed={optimistic.liked}
            aria-label={optimistic.liked ? 'Unlike' : 'Like'}
            onClick={() => toggleLike()}
          >
            <span className={railIcon}>
              <HeartIcon
                className={cn('size-7', optimistic.liked && 'fill-rose-500 text-rose-500')}
                aria-hidden
              />
            </span>
            <span className="tabular-nums drop-shadow">{formatCount(optimistic.count)}</span>
          </button>
          <button type="button" className={railButton} aria-label="Share" onClick={share}>
            <span className={railIcon}>
              <SendIcon className="size-6" aria-hidden />
            </span>
          </button>
          {reel.author.id === viewerId ? (
            <DropdownMenu>
              <DropdownMenuTrigger className={railButton} aria-label="More">
                <span className={railIcon}>
                  <MoreHorizontalIcon className="size-6" aria-hidden />
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top">
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive [&_svg]:text-destructive"
                  onSelect={() => {
                    if (!window.confirm('Delete this reel? This can’t be undone.')) return;
                    void deleteReel({ reelId: reel.id }).then((result) => {
                      if (!result.ok) {
                        toast.error(result.error.message);
                        return;
                      }
                      toast.success('Reel deleted');
                      onDeleted();
                    });
                  }}
                >
                  <Trash2Icon /> Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>
      </div>
    </div>
  );
}
