'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { ChevronLeftIcon, ChevronRightIcon, XIcon } from 'lucide-react';
import { Dialog } from 'radix-ui';
import type { PostPhoto } from '@carza/shared';
import { publicStorageUrl } from '@/lib/storage';
import { cn } from '@/lib/utils';

/**
 * One photo shows at its own shape (capped so tall shots don't fill the screen). Two or more scroll
 * sideways at a shared height, like Threads. Width/height are stored, so nothing shifts while loading.
 * Tapping a photo opens it full screen.
 */
export function PostPhotos({
  photos,
  priority = false,
}: {
  photos: PostPhoto[];
  priority?: boolean;
}) {
  const [openAt, setOpenAt] = useState<number | null>(null);
  if (photos.length === 0) return null;
  const single = photos.length === 1;
  return (
    <>
      <div
        className={cn(
          'relative z-10 mt-2',
          !single &&
            '-mr-4 flex snap-x snap-mandatory gap-2 overflow-x-auto pr-4 [scrollbar-width:none]',
        )}
      >
        {photos.map((photo, i) => (
          <button
            key={photo.path}
            type="button"
            onClick={() => setOpenAt(i)}
            aria-label={single ? 'Open photo' : `Open photo ${i + 1} of ${photos.length}`}
            className={cn(
              'focus-visible:ring-ring/50 block w-fit max-w-full cursor-zoom-in rounded-xl outline-none focus-visible:ring-[3px]',
              !single && 'max-w-[80%] shrink-0 snap-start',
            )}
          >
            <Image
              src={publicStorageUrl('post-photos', photo.path)}
              alt=""
              width={photo.width}
              height={photo.height}
              priority={priority && i === 0}
              sizes={single ? '(min-width: 640px) 540px, 90vw' : '260px'}
              className={cn(
                'bg-muted rounded-xl border object-cover',
                single ? 'max-h-[520px] w-auto max-w-full' : 'h-64 w-auto max-w-full',
              )}
            />
          </button>
        ))}
      </div>
      {openAt !== null ? (
        <PhotoViewer photos={photos} start={openAt} onClose={() => setOpenAt(null)} />
      ) : null}
    </>
  );
}

/** Full-screen photos: swipe or use the arrow keys, Escape closes. */
function PhotoViewer({
  photos,
  start,
  onClose,
}: {
  photos: PostPhoto[];
  start: number;
  onClose: () => void;
}) {
  const [track, setTrack] = useState<HTMLDivElement | null>(null);
  const [index, setIndex] = useState(start);

  // Open on the tapped photo.
  useEffect(() => {
    if (!track) return;
    track.scrollTo({ left: start * track.clientWidth, behavior: 'instant' });
    const onScroll = () => setIndex(Math.round(track.scrollLeft / Math.max(1, track.clientWidth)));
    track.addEventListener('scroll', onScroll, { passive: true });
    return () => track.removeEventListener('scroll', onScroll);
    // start only matters when the track mounts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [track]);

  const go = (i: number) => {
    if (!track || i < 0 || i >= photos.length) return;
    track.scrollTo({ left: i * track.clientWidth, behavior: 'smooth' });
  };
  const many = photos.length > 1;
  const arrow =
    'absolute top-1/2 hidden size-11 -translate-y-1/2 place-items-center rounded-full bg-white/10 text-white outline-none hover:bg-white/20 focus-visible:ring-[3px] focus-visible:ring-white/70 disabled:opacity-0 sm:grid';

  return (
    <Dialog.Root open onOpenChange={(o) => !o && onClose()}>
      <Dialog.Portal>
        <Dialog.Overlay className="data-[state=open]:animate-in data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/95" />
        <Dialog.Content
          aria-describedby={undefined}
          className="fixed inset-0 z-50 flex flex-col outline-none"
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') go(index - 1);
            if (e.key === 'ArrowRight') go(index + 1);
          }}
        >
          <div className="flex items-center justify-between px-4 py-3 text-white">
            <Dialog.Title className="text-sm font-medium tabular-nums">
              {many ? `${index + 1} of ${photos.length}` : 'Photo'}
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
              ref={setTrack}
              className="absolute inset-0 flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            >
              {photos.map((photo) => (
                <div
                  key={photo.path}
                  className="relative h-full w-full shrink-0 snap-center"
                  // Tapping the dark space around the photo closes, like Threads.
                  onClick={(e) => e.target === e.currentTarget && onClose()}
                >
                  <Image
                    src={publicStorageUrl('post-photos', photo.path)}
                    alt=""
                    fill
                    sizes="100vw"
                    className="pointer-events-none object-contain"
                  />
                </div>
              ))}
            </div>
            {many ? (
              <>
                <button
                  type="button"
                  aria-label="Previous photo"
                  className={cn(arrow, 'left-4')}
                  disabled={index === 0}
                  onClick={() => go(index - 1)}
                >
                  <ChevronLeftIcon className="size-6" />
                </button>
                <button
                  type="button"
                  aria-label="Next photo"
                  className={cn(arrow, 'right-4')}
                  disabled={index === photos.length - 1}
                  onClick={() => go(index + 1)}
                >
                  <ChevronRightIcon className="size-6" />
                </button>
              </>
            ) : null}
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
