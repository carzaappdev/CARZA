'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ClapperboardIcon, PlusIcon, Volume2Icon, VolumeXIcon } from 'lucide-react';
import type { ReelsPage, ReelView } from '@carza/db';
import { loadReelsPage } from '@/lib/actions/reels';
import { ReelItem, type ReelViewer } from './reel-item';

/**
 * Full-height vertical swipe feed. Bandwidth matters on the free tier, so only the reel on screen and its
 * neighbours get a <video>; everything else is just its poster. The one on screen plays, muted until the
 * viewer taps the sound button (browsers block autoplay with sound).
 */
export function ReelsFeed({
  initial,
  viewer,
  createHref,
}: {
  initial: ReelsPage;
  viewer: ReelViewer | null;
  createHref: Route;
}) {
  const [reels, setReels] = useState<ReelView[]>(initial.reels);
  const [next, setNext] = useState(initial.next);
  const [active, setActive] = useState(0);
  const [muted, setMuted] = useState(true);
  const scroller = useRef<HTMLDivElement>(null);
  const loading = useRef(false);

  // The reel that fills most of the screen is the active one.
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(Number((entry.target as HTMLElement).dataset.index));
        }
      },
      { root, threshold: 0.6 },
    );
    root.querySelectorAll('[data-index]').forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, [reels.length]);

  // Fetch the next page while two reels remain.
  useEffect(() => {
    if (!next || loading.current || active < reels.length - 3) return;
    loading.current = true;
    void loadReelsPage(next).then((result) => {
      loading.current = false;
      if (!result.ok) return;
      setReels((all) => {
        const seen = new Set(all.map((r) => r.id));
        return [...all, ...result.data.reels.filter((r) => !seen.has(r.id))];
      });
      setNext(result.data.next);
    });
  }, [active, next, reels.length]);

  // Arrow keys and j/k move between reels on desktop.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.target instanceof HTMLElement && e.target.closest('input, textarea, [role="menu"]'))
        return;
      const step =
        e.key === 'ArrowDown' || e.key === 'j' ? 1 : e.key === 'ArrowUp' || e.key === 'k' ? -1 : 0;
      if (!step || !scroller.current) return;
      e.preventDefault();
      scroller.current.scrollBy({ top: step * scroller.current.clientHeight, behavior: 'smooth' });
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const remove = useCallback((id: string) => setReels((all) => all.filter((r) => r.id !== id)), []);

  return (
    <div className="relative mx-auto h-[calc(100dvh-7rem-env(safe-area-inset-bottom))] w-full bg-black md:h-[calc(100dvh-4rem)] md:max-w-[480px]">
      {reels.length === 0 ? (
        <div className="flex h-full flex-col items-center justify-center gap-4 px-8 text-center text-white">
          <span className="grid size-16 place-items-center rounded-2xl bg-white/10">
            <ClapperboardIcon className="size-8" aria-hidden />
          </span>
          <h2 className="font-display text-2xl font-bold">No reels yet</h2>
          <p className="max-w-xs text-white/70">
            Post the first one: a cold start, a walkaround, a launch.
          </p>
          <Link
            href={createHref}
            className="h-11 rounded-full bg-white px-5 leading-11 font-semibold text-black"
          >
            Post a reel
          </Link>
        </div>
      ) : (
        <div
          ref={scroller}
          className="h-full snap-y snap-mandatory overflow-y-scroll overscroll-contain [scrollbar-width:none]"
        >
          {reels.map((reel, i) => (
            <div key={reel.id} data-index={i} className="relative h-full snap-start snap-always">
              <ReelItem
                reel={reel}
                viewer={viewer}
                active={i === active}
                // The neighbours get a <video> that buffers ahead; the rest are just posters.
                mounted={Math.abs(i - active) <= 1}
                // The next reel buffers fully so swiping to it starts instantly.
                upNext={i === active + 1}
                muted={muted}
                onDeleted={() => remove(reel.id)}
              />
            </div>
          ))}
        </div>
      )}

      <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/50 to-transparent p-3">
        <h1 className="font-display px-1 text-lg font-bold text-white drop-shadow">Reels</h1>
        <div className="pointer-events-auto flex gap-2">
          {reels.length > 0 ? (
            <button
              type="button"
              onClick={() => setMuted((m) => !m)}
              aria-label={muted ? 'Turn sound on' : 'Mute'}
              className="grid size-10 place-items-center rounded-full bg-black/40 text-white backdrop-blur outline-none focus-visible:ring-[3px] focus-visible:ring-white/60"
            >
              {muted ? <VolumeXIcon className="size-5" /> : <Volume2Icon className="size-5" />}
            </button>
          ) : null}
          <Link
            href={createHref}
            aria-label="Post a reel"
            className="grid size-10 place-items-center rounded-full bg-white text-black outline-none focus-visible:ring-[3px] focus-visible:ring-white/60"
          >
            <PlusIcon className="size-5" />
          </Link>
        </div>
      </div>
    </div>
  );
}
