import { Skeleton } from '@/components/ui/skeleton';

/** Generic loading state for account and dealer pages: a title and a few rows. */
export function PageSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading…</span>
      <Skeleton className="h-8 w-48" />
      <div className="flex flex-col gap-3">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    </div>
  );
}

/**
 * Loading state for the app tabs: the same 640px column as Feed, Events and profiles, filled with
 * post-shaped rows, so nothing jumps when the page arrives.
 */
export function ColumnSkeleton() {
  return (
    <div
      className="mx-auto w-full max-w-[640px] flex-1 sm:border-x"
      aria-busy="true"
      aria-live="polite"
    >
      <span className="sr-only">Loading…</span>
      <div className="h-12 border-b" />
      {Array.from({ length: 5 }, (_, i) => (
        <div key={i} className="flex gap-3 border-b px-4 py-4">
          <Skeleton className="size-9 shrink-0 rounded-full" />
          <div className="flex flex-1 flex-col gap-2.5 pt-1">
            <Skeleton className="h-3.5 w-40" />
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3.5 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}
