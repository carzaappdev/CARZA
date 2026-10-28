import { SparklesIcon, StarIcon } from 'lucide-react';

/** "Founding member #12" and "Featured" chips on a profile. */
export function ProfileBadges({
  foundingNumber,
  featured,
}: {
  foundingNumber: number | null;
  featured: boolean;
}) {
  if (!foundingNumber && !featured) return null;
  return (
    <div className="flex flex-wrap gap-1.5">
      {foundingNumber ? (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/12 px-2.5 py-1 text-xs font-semibold text-amber-700 ring-1 ring-amber-500/25 dark:text-amber-300">
          <SparklesIcon className="size-3.5" aria-hidden />
          Founding member #{foundingNumber}
        </span>
      ) : null}
      {featured ? (
        <span className="bg-muted inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold">
          <StarIcon className="size-3.5 fill-current" aria-hidden />
          Featured
        </span>
      ) : null}
    </div>
  );
}
