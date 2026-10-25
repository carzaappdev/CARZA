import { Skeleton } from '@/components/ui/skeleton';

/** Generic loading state: a page title and a grid of cards. Swap per page once real content lands. */
export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-48" />
        ))}
      </div>
    </div>
  );
}
