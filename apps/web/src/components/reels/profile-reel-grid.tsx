import type { Route } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { PlayIcon } from 'lucide-react';
import type { ProfileReel } from '@carza/db';
import { formatCount } from '@carza/shared';
import { publicStorageUrl } from '@/lib/storage';

/** Three-across grid of reel posters with view counts, like a profile on TikTok or Instagram. */
export function ProfileReelGrid({ reels }: { reels: ProfileReel[] }) {
  return (
    <ul className="grid grid-cols-3 gap-0.5">
      {reels.map((reel) => (
        <li key={reel.id}>
          <Link
            href={`/reels/${reel.id}` as Route}
            aria-label={`${reel.caption || 'Reel'}, ${formatCount(reel.viewCount)} views`}
            className="focus-visible:ring-ring/50 relative block aspect-[9/16] overflow-hidden bg-black outline-none focus-visible:ring-[3px] focus-visible:ring-inset"
          >
            <Image
              src={publicStorageUrl('reels', reel.posterPath)}
              alt=""
              fill
              sizes="(min-width: 640px) 213px, 33vw"
              className="object-cover transition-opacity hover:opacity-90"
            />
            <span className="absolute bottom-1.5 left-2 flex items-center gap-1 text-xs font-semibold text-white drop-shadow">
              <PlayIcon className="size-3.5 fill-white" aria-hidden />
              {formatCount(reel.viewCount)}
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
