'use client';

import Image from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, ExpandIcon, XIcon } from 'lucide-react';
import { Dialog } from 'radix-ui';
import { cn } from '@/lib/utils';
import { ListingPhoto, listingPhotoUrl } from './listing-photo';

type Photo = { storage_path: string };

/**
 * A swipeable scroll-snap strip: `setTrack` is the scrolling track's ref, `index` is the slide in view.
 * A callback ref, so it also works for the full-screen viewer, whose track mounts only when opened.
 */
function useCarousel(count: number, startAt = 0) {
  const node = useRef<HTMLDivElement | null>(null);
  const [el, setEl] = useState<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(startAt);

  const setTrack = useCallback(
    (n: HTMLDivElement | null) => {
      node.current = n;
      setEl(n);
      // A reopened viewer starts on the chosen photo, even when no scroll event fires.
      if (n) setIndex(startAt);
    },
    [startAt],
  );

  const go = useCallback(
    (i: number, behavior: ScrollBehavior = 'smooth') => {
      const track = node.current;
      if (!track) return;
      track.scrollTo({ left: ((i + count) % count) * track.clientWidth, behavior });
    },
    [count],
  );

  useEffect(() => {
    if (!el) return;
    el.scrollTo({ left: startAt * el.clientWidth, behavior: 'instant' });
    const onScroll = () => setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
    // startAt only matters when the track mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [el]);

  return { setTrack, index, go };
}

function Arrows({
  onPrev,
  onNext,
  dark,
}: {
  onPrev: () => void;
  onNext: () => void;
  dark?: boolean;
}) {
  const cls = cn(
    'absolute top-1/2 z-10 grid size-11 -translate-y-1/2 place-items-center rounded-full shadow-md outline-none focus-visible:ring-[3px] focus-visible:ring-white/70',
    dark ? 'bg-white/15 text-white hover:bg-white/25' : 'bg-background/90 hover:bg-background',
  );
  return (
    <>
      <button
        type="button"
        className={cn(cls, 'left-3')}
        onClick={onPrev}
        aria-label="Previous photo"
      >
        <ChevronLeftIcon className="size-5" />
      </button>
      <button type="button" className={cn(cls, 'right-3')} onClick={onNext} aria-label="Next photo">
        <ChevronRightIcon className="size-5" />
      </button>
    </>
  );
}

/**
 * Listing photos: a swipeable main viewer with arrows, a counter and thumbnails, plus a full-screen viewer
 * (arrow keys, swipe, Esc to close).
 */
export function PhotoGallery({ photos, title }: { photos: Photo[]; title: string }) {
  const { setTrack: setMainTrack, index: mainIndex, go: goMain } = useCarousel(photos.length);
  const [fullAt, setFullAt] = useState<number | null>(null);
  const {
    setTrack: setFullTrack,
    index: fullIndex,
    go: goFull,
  } = useCarousel(photos.length, fullAt ?? 0);
  const alt = (i: number) => `${title}, photo ${i + 1} of ${photos.length}`;

  if (photos.length === 0) {
    return (
      <div className="relative aspect-[16/10] overflow-hidden rounded-2xl">
        <ListingPhoto path={null} alt="" sizes="100vw" />
      </div>
    );
  }

  const many = photos.length > 1;
  return (
    <div className="flex flex-col gap-3">
      <div
        className="group relative overflow-hidden rounded-2xl bg-black"
        role="region"
        aria-roledescription="carousel"
        aria-label={`${title} photos`}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') goMain(mainIndex - 1);
          if (e.key === 'ArrowRight') goMain(mainIndex + 1);
        }}
      >
        <div
          ref={setMainTrack}
          className="flex aspect-[16/10] snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          {photos.map((p, i) => (
            <button
              key={p.storage_path}
              type="button"
              className="relative h-full w-full shrink-0 snap-center cursor-zoom-in"
              onClick={() => setFullAt(i)}
              aria-label={`Open ${alt(i)} full screen`}
            >
              <Image
                src={listingPhotoUrl(p.storage_path)}
                alt={alt(i)}
                fill
                sizes="(min-width: 1024px) 66vw, 100vw"
                priority={i === 0}
                className="object-cover"
              />
            </button>
          ))}
        </div>
        {many && (
          <div className="opacity-100 transition-opacity md:opacity-0 md:group-focus-within:opacity-100 md:group-hover:opacity-100">
            <Arrows onPrev={() => goMain(mainIndex - 1)} onNext={() => goMain(mainIndex + 1)} />
          </div>
        )}
        <span className="pointer-events-none absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full bg-black/65 px-3 py-1 text-xs font-medium text-white">
          <ExpandIcon aria-hidden className="size-3.5" />
          <span aria-live="polite">
            {mainIndex + 1} / {photos.length}
          </span>
        </span>
      </div>

      {many && (
        <ul className="flex gap-2 overflow-x-auto pb-1" aria-label="Choose a photo">
          {photos.map((p, i) => (
            <li key={p.storage_path} className="shrink-0">
              <button
                type="button"
                onClick={() => goMain(i)}
                aria-label={`Show photo ${i + 1}`}
                aria-current={i === mainIndex}
                className={cn(
                  'focus-visible:ring-ring/50 relative block h-16 w-24 overflow-hidden rounded-lg outline-none focus-visible:ring-[3px]',
                  i === mainIndex ? 'ring-primary ring-2' : 'opacity-70 hover:opacity-100',
                )}
              >
                <Image
                  src={listingPhotoUrl(p.storage_path)}
                  alt=""
                  fill
                  sizes="96px"
                  className="object-cover"
                />
              </button>
            </li>
          ))}
        </ul>
      )}

      <Dialog.Root open={fullAt !== null} onOpenChange={(o) => !o && setFullAt(null)}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-50 bg-black/95" />
          <Dialog.Content
            aria-describedby={undefined}
            className="fixed inset-0 z-50 flex flex-col outline-none"
            onKeyDown={(e) => {
              if (e.key === 'ArrowLeft') goFull(fullIndex - 1);
              if (e.key === 'ArrowRight') goFull(fullIndex + 1);
            }}
          >
            <div className="flex items-center justify-between px-4 py-3 text-white">
              <Dialog.Title className="truncate text-sm font-medium">
                {title}
                <span className="text-white/60">
                  {' '}
                  · {fullIndex + 1} of {photos.length}
                </span>
              </Dialog.Title>
              <Dialog.Close
                className="grid size-11 place-items-center rounded-full outline-none hover:bg-white/10 focus-visible:ring-[3px] focus-visible:ring-white/70"
                aria-label="Close"
              >
                <XIcon className="size-6" />
              </Dialog.Close>
            </div>
            <div className="relative flex-1">
              <div
                ref={setFullTrack}
                className="absolute inset-0 flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                {photos.map((p, i) => (
                  <div key={p.storage_path} className="relative h-full w-full shrink-0 snap-center">
                    <Image
                      src={listingPhotoUrl(p.storage_path)}
                      alt={alt(i)}
                      fill
                      sizes="100vw"
                      className="object-contain"
                    />
                  </div>
                ))}
              </div>
              {many && (
                <Arrows
                  dark
                  onPrev={() => goFull(fullIndex - 1)}
                  onNext={() => goFull(fullIndex + 1)}
                />
              )}
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  );
}
