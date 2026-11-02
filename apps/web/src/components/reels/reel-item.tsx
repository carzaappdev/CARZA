'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useOptimistic, useRef, useState, useTransition } from 'react';
import {
  CheckIcon,
  HeartIcon,
  MessageCircleIcon,
  MoreHorizontalIcon,
  PlayIcon,
  RotateCwIcon,
  SendIcon,
  Trash2Icon,
} from 'lucide-react';
import { toast } from 'sonner';
import type { ReelView } from '@carza/db';
import { formatCount, formatRelativeTime } from '@carza/shared';
import { RichText } from '@/components/feed/rich-text';
import { UserAvatar } from '@/components/feed/user-avatar';
import { useSafetyActions } from '@/components/safety/use-safety-actions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { setFollowing } from '@/lib/actions/follows';
import { deleteReel, recordReelView, setReelLiked } from '@/lib/actions/reels';
import { publicStorageUrl } from '@/lib/storage';
import { cn } from '@/lib/utils';
import { ReelComments } from './reel-comments';

/** A random id this browser keeps, so a guest's views count once per reel. */
function guestId() {
  try {
    let id = localStorage.getItem('carza:guest-id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('carza:guest-id', id);
    }
    return id;
  } catch {
    return null;
  }
}

/** Two taps closer together than this are a double-tap (like); a single tap waits this long to pause. */
const DOUBLE_TAP_MS = 260;

const railButton =
  'flex flex-col items-center gap-1 text-xs font-semibold text-white outline-none focus-visible:[&>span:first-child]:ring-[3px] focus-visible:[&>span:first-child]:ring-white/60';
const railIcon =
  'grid size-12 place-items-center rounded-full bg-black/30 backdrop-blur transition-transform active:scale-90';
const captionLink = 'relative z-10 font-semibold text-white hover:underline';

export type ReelViewer = { id: string; displayName: string; avatarPath: string | null };

export function ReelItem({
  reel,
  viewer,
  active,
  mounted,
  upNext,
  muted,
  onDeleted,
  onFollowed,
}: {
  reel: ReelView;
  viewer: ReelViewer | null;
  active: boolean;
  mounted: boolean;
  upNext: boolean;
  muted: boolean;
  onDeleted: () => void;
  onFollowed: (authorId: string, following: boolean) => void;
}) {
  const viewerId = viewer?.id ?? null;
  const router = useRouter();
  const signInHref = `/sign-in?next=${encodeURIComponent(`/reels/${reel.id}`)}` as Route;
  const [commentCount, setCommentCount] = useState(reel.commentCount);
  const progress = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [failed, setFailed] = useState(false);
  const [scrubbing, setScrubbing] = useState(false);
  const [like, setLike] = useState({ liked: reel.liked, count: reel.likeCount });
  const [optimistic, setOptimistic] = useOptimistic(like);
  const [, startTransition] = useTransition();
  // Followed from this reel (other reels by the author just drop their Follow button).
  const [followed, setFollowed] = useState(false);
  const [bursts, setBursts] = useState<{ key: number; x: number; y: number; tilt: number }[]>([]);
  const tap = useRef({ last: 0, timer: 0 });
  const caption = useRef<HTMLParagraphElement>(null);
  const [expandedState, setExpanded] = useState(false);
  // The caption collapses again once the viewer swipes away.
  const expanded = expandedState && active;
  const [clamped, setClamped] = useState(false);
  const safety = useSafetyActions({
    targetType: 'reel',
    targetId: reel.id,
    owner: reel.author,
    viewerId,
    onBlocked: onDeleted,
  });
  // Vertical clips fill the screen; landscape ones are letterboxed rather than cropped.
  const fit = reel.height >= reel.width ? 'object-cover' : 'object-contain';
  const poster = publicStorageUrl('reels', reel.posterPath);
  const isOwn = reel.author.id === viewerId;

  // Play the reel on screen from the start; stop the others. Pause while the tab is hidden.
  useEffect(() => {
    const el = video.current;
    if (!el) return;
    if (!active) {
      el.pause();
      return;
    }
    el.currentTime = 0;
    // onPlay/onPause keep `paused` in sync; if autoplay is blocked, show the play button.
    el.play().catch(() => setPaused(true));
    let resume = false;
    function onVisibility() {
      if (!el) return;
      if (document.hidden) {
        resume = !el.paused;
        el.pause();
      } else if (resume) void el.play().catch(() => undefined);
    }
    document.addEventListener('visibilitychange', onVisibility);
    return () => document.removeEventListener('visibilitychange', onVisibility);
  }, [active, mounted]);

  // A smooth progress bar: follow the playhead every frame while this reel is on screen.
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const tick = () => {
      const el = video.current;
      if (el && progress.current && el.duration)
        progress.current.style.transform = `scaleX(${el.currentTime / el.duration})`;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [active]);

  // A view counts once the reel has been on screen for 2 seconds.
  useEffect(() => {
    if (!active) return;
    const timer = window.setTimeout(() => {
      void recordReelView({ reelId: reel.id, guestId: viewerId ? null : guestId() });
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [active, reel.id, viewerId]);

  // Only offer "more" when the caption is actually cut off.
  useEffect(() => {
    const el = caption.current;
    if (el && !expanded) setClamped(el.scrollHeight > el.clientHeight + 1);
  }, [reel.caption, expanded]);

  useEffect(() => () => window.clearTimeout(tap.current.timer), []);

  function togglePlay() {
    const el = video.current;
    if (!el) return;
    if (el.paused) void el.play().catch(() => undefined);
    else el.pause();
  }

  function toggleLike(force?: boolean) {
    if (!viewerId) {
      router.push(signInHref);
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

  function follow() {
    if (!viewerId) {
      router.push(signInHref);
      return;
    }
    setFollowed(true);
    onFollowed(reel.author.id, true);
    void setFollowing({ userId: reel.author.id, following: true }).then((result) => {
      if (result.ok) return;
      setFollowed(false);
      onFollowed(reel.author.id, false);
      toast.error(result.error.message);
    });
  }

  /** Single tap pauses; double tap likes with a heart where the finger landed (like TikTok/Reels). */
  function onTap(e: React.MouseEvent<HTMLButtonElement>) {
    // Keyboard "clicks" have no pointer position and never double-tap.
    if (e.detail === 0) return togglePlay();
    const now = Date.now();
    window.clearTimeout(tap.current.timer);
    if (now - tap.current.last < DOUBLE_TAP_MS) {
      tap.current.last = 0;
      const box = e.currentTarget.getBoundingClientRect();
      const burst = {
        key: now,
        x: e.clientX - box.left,
        y: e.clientY - box.top,
        tilt: Math.round(Math.random() * 40 - 20),
      };
      setBursts((all) => [...all, burst]);
      window.setTimeout(() => setBursts((all) => all.filter((b) => b.key !== burst.key)), 800);
      toggleLike(true);
      return;
    }
    tap.current.last = now;
    tap.current.timer = window.setTimeout(togglePlay, DOUBLE_TAP_MS);
  }

  /** Drag along the bottom bar to scrub. */
  function seek(e: React.PointerEvent<HTMLDivElement>) {
    const el = video.current;
    if (!el?.duration) return;
    const box = e.currentTarget.getBoundingClientRect();
    const at = Math.min(1, Math.max(0, (e.clientX - box.left) / box.width));
    el.currentTime = at * el.duration;
    if (progress.current) progress.current.style.transform = `scaleX(${at})`;
  }

  async function share() {
    const url = `${window.location.origin}/reels/${reel.id}`;
    try {
      if (navigator.share)
        await navigator.share({ url, title: `${reel.author.display_name} on Carza` });
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
          disablePictureInPicture
          disableRemotePlayback
          preload={active || upNext ? 'auto' : 'metadata'}
          className={cn('absolute inset-0 size-full', fit)}
          onPlay={() => setPaused(false)}
          onPause={() => setPaused(true)}
          onWaiting={() => setBuffering(true)}
          onPlaying={() => {
            setBuffering(false);
            setFailed(false);
          }}
          onCanPlay={() => setBuffering(false)}
          onError={() => setFailed(true)}
        />
      ) : null}

      {/* Tap to pause/play; double-tap to like. */}
      <button
        type="button"
        aria-label={paused ? 'Play' : 'Pause'}
        className="absolute inset-0 outline-none [-webkit-tap-highlight-color:transparent]"
        onClick={onTap}
      />
      {failed && active ? (
        <div className="absolute inset-0 grid place-items-center">
          <div className="flex flex-col items-center gap-3 rounded-2xl bg-black/60 px-6 py-5 text-center text-white backdrop-blur">
            <p className="font-semibold">This reel didn’t load.</p>
            <button
              type="button"
              onClick={() => {
                setFailed(false);
                video.current?.load();
                void video.current?.play().catch(() => undefined);
              }}
              className="inline-flex h-10 items-center gap-2 rounded-full bg-white px-4 text-sm font-semibold text-black outline-none focus-visible:ring-[3px] focus-visible:ring-white/60"
            >
              <RotateCwIcon className="size-4" aria-hidden /> Try again
            </button>
          </div>
        </div>
      ) : paused && active && !scrubbing ? (
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="animate-in zoom-in-75 fade-in grid size-16 place-items-center rounded-full bg-black/40 backdrop-blur duration-150">
            <PlayIcon className="size-8 translate-x-0.5 fill-white text-white" aria-hidden />
          </span>
        </span>
      ) : buffering && active ? (
        <span className="pointer-events-none absolute inset-0 grid place-items-center">
          {/* Fades in late so a quick stall doesn't flash a spinner. */}
          <span className="animate-in fade-in fill-mode-backwards delay-500 duration-300">
            <span
              className="block size-10 animate-spin rounded-full border-2 border-white/25 border-t-white"
              aria-label="Loading"
            />
          </span>
        </span>
      ) : null}
      {bursts.map((b) => (
        <HeartIcon
          key={b.key}
          aria-hidden
          style={{ left: b.x, top: b.y, rotate: `${b.tilt}deg` }}
          className="animate-out zoom-out-150 fade-out fill-mode-forwards pointer-events-none absolute size-24 -translate-x-1/2 -translate-y-1/2 fill-rose-500 text-rose-500 drop-shadow-lg delay-300 duration-500"
        />
      ))}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/75 via-black/30 to-transparent" />
      {/* While a long caption is open, dim the video so it stays readable. */}
      {expanded ? <div className="pointer-events-none absolute inset-0 bg-black/40" /> : null}

      <div className="pointer-events-none absolute right-0 bottom-0 left-0 flex items-end gap-3 p-4 pb-6">
        <div className="pointer-events-auto min-w-0 flex-1 text-white">
          <div className="flex min-w-0 items-center gap-2">
            <Link
              href={`/u/${reel.author.username}` as Route}
              className="relative inline-flex min-w-0 items-center gap-2 rounded-full outline-none focus-visible:ring-[3px] focus-visible:ring-white/60"
            >
              <UserAvatar
                name={reel.author.display_name}
                path={reel.author.avatar_path}
                className="size-9 ring-2 ring-white/80"
              />
              <span className="truncate font-semibold drop-shadow">{reel.author.display_name}</span>
            </Link>
            {isOwn || (reel.following && !followed) ? null : followed ? (
              <span className="animate-in fade-in inline-flex h-7 shrink-0 items-center gap-1 rounded-full border border-white/40 px-2.5 text-xs font-semibold">
                <CheckIcon className="size-3.5" aria-hidden /> Following
              </span>
            ) : (
              <button
                type="button"
                onClick={follow}
                className="h-7 shrink-0 rounded-full border border-white/70 px-3 text-xs font-semibold outline-none hover:bg-white/10 focus-visible:ring-[3px] focus-visible:ring-white/60"
              >
                Follow
              </button>
            )}
          </div>
          {reel.caption ? (
            <div className={cn(expanded && 'max-h-[40dvh] overflow-y-auto')}>
              <p
                ref={caption}
                className={cn(
                  'mt-2 text-[15px] leading-snug break-words whitespace-pre-wrap drop-shadow',
                  !expanded && 'line-clamp-2',
                )}
              >
                <RichText text={reel.caption} linkClassName={captionLink} />
              </p>
              {clamped || expanded ? (
                <button
                  type="button"
                  onClick={() => setExpanded(!expanded)}
                  className="mt-0.5 rounded text-sm font-semibold text-white/80 outline-none focus-visible:ring-[3px] focus-visible:ring-white/60"
                >
                  {expanded ? 'less' : 'more'}
                </button>
              ) : null}
            </div>
          ) : null}
          <p className="mt-1.5 text-sm text-white/70 drop-shadow">
            {reel.viewCount > 0
              ? `${formatCount(reel.viewCount)} ${reel.viewCount === 1 ? 'view' : 'views'} · `
              : null}
            <time dateTime={reel.createdAt}>{formatRelativeTime(reel.createdAt)}</time>
          </p>
        </div>

        <div className="pointer-events-auto relative flex flex-col items-center gap-4">
          <button
            type="button"
            className={railButton}
            aria-pressed={optimistic.liked}
            aria-label={optimistic.liked ? 'Unlike' : 'Like'}
            onClick={() => toggleLike()}
          >
            <span className={railIcon}>
              <HeartIcon
                key={String(optimistic.liked)}
                className={cn(
                  'size-7',
                  optimistic.liked &&
                    'animate-in zoom-in-50 fill-rose-500 text-rose-500 duration-300',
                )}
                aria-hidden
              />
            </span>
            <span className="tabular-nums drop-shadow">{formatCount(optimistic.count)}</span>
          </button>
          <ReelComments reelId={reel.id} viewer={viewer} onCountChange={setCommentCount}>
            <button type="button" className={railButton} aria-label={`Comments, ${commentCount}`}>
              <span className={railIcon}>
                <MessageCircleIcon className="size-6" aria-hidden />
              </span>
              <span className="tabular-nums drop-shadow">{formatCount(commentCount)}</span>
            </button>
          </ReelComments>
          <button type="button" className={railButton} aria-label="Share" onClick={share}>
            <span className={railIcon}>
              <SendIcon className="size-6" aria-hidden />
            </span>
            <span className="drop-shadow">Share</span>
          </button>
          {isOwn || safety.items ? (
            <DropdownMenu>
              <DropdownMenuTrigger className={railButton} aria-label="More">
                <span className={railIcon}>
                  <MoreHorizontalIcon className="size-6" aria-hidden />
                </span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" side="top">
                {safety.items}
                {isOwn ? (
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
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
          {safety.dialog}
        </div>
      </div>

      {/* Progress bar; drag it to scrub. The hit area is taller than the bar for fingers. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 flex h-4 cursor-pointer touch-none items-end"
        onPointerDown={(e) => {
          if (!video.current?.duration) return;
          e.currentTarget.setPointerCapture(e.pointerId);
          setScrubbing(true);
          seek(e);
        }}
        onPointerMove={(e) => {
          if (scrubbing) seek(e);
        }}
        onPointerUp={() => setScrubbing(false)}
        onPointerCancel={() => setScrubbing(false)}
      >
        <div
          className={cn(
            'w-full bg-white/20 transition-[height] duration-150',
            scrubbing ? 'h-1.5' : 'h-0.5',
          )}
        >
          <div ref={progress} className="h-full origin-left scale-x-0 bg-white/90" />
        </div>
      </div>
    </div>
  );
}
