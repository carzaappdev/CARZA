import Image from 'next/image';
import type { PostPhoto } from '@carza/shared';
import { publicStorageUrl } from '@/lib/storage';
import { cn } from '@/lib/utils';

/**
 * One photo shows at its own shape (capped so tall shots don't fill the screen). Two or more scroll
 * sideways at a shared height, like Threads. Width/height are stored, so nothing shifts while loading.
 */
export function PostPhotos({
  photos,
  priority = false,
}: {
  photos: PostPhoto[];
  priority?: boolean;
}) {
  if (photos.length === 0) return null;
  const single = photos.length === 1;
  return (
    <div
      className={cn(
        'relative z-10 mt-2',
        !single &&
          '-mr-4 flex snap-x snap-mandatory gap-2 overflow-x-auto pr-4 [scrollbar-width:none]',
      )}
    >
      {photos.map((photo, i) => (
        <Image
          key={photo.path}
          src={publicStorageUrl('post-photos', photo.path)}
          alt=""
          width={photo.width}
          height={photo.height}
          priority={priority && i === 0}
          sizes={single ? '(min-width: 640px) 540px, 90vw' : '260px'}
          className={cn(
            'bg-muted rounded-xl border object-cover',
            single
              ? 'max-h-[520px] w-auto max-w-full'
              : 'h-64 w-auto max-w-[80%] shrink-0 snap-start',
          )}
        />
      ))}
    </div>
  );
}
