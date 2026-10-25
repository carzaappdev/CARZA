import Image from 'next/image';
import { clientEnv } from '@/env/client';

/** Public URL for an object in the (public) listing-photos bucket. */
export const listingPhotoUrl = (path: string) =>
  `${clientEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/listing-photos/${path}`;

/** A listing photo filling its (relatively positioned) parent, or a placeholder when there's none. */
export function ListingPhoto({
  path,
  alt,
  sizes,
  priority = false,
}: {
  path: string | null | undefined;
  alt: string;
  sizes: string;
  priority?: boolean;
}) {
  if (!path) {
    return (
      <div className="bg-muted text-muted-foreground absolute inset-0 grid place-items-center">
        <div className="flex flex-col items-center gap-2">
          <svg
            aria-hidden
            viewBox="0 0 64 32"
            className="w-16 opacity-50"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path
              d="M4 24h4m48 0h4V18l-6-3-8-8H22l-9 8-9 3v6h4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle cx="15" cy="24" r="5" />
            <circle cx="49" cy="24" r="5" />
            <path d="M20 24h24" />
          </svg>
          <span className="text-xs font-medium">No photos yet</span>
        </div>
      </div>
    );
  }
  return (
    <Image
      src={listingPhotoUrl(path)}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className="object-cover"
    />
  );
}
