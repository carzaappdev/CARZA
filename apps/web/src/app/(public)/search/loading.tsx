export default function SearchLoading() {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6" aria-busy="true">
      <span className="sr-only">Loading cars…</span>
      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <div className="bg-muted hidden h-[480px] animate-pulse rounded-xl lg:block" />
        <div className="flex flex-col gap-6">
          <div className="bg-muted h-9 w-64 animate-pulse rounded-md" />
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <div key={i} className="bg-muted aspect-[4/5] animate-pulse rounded-xl" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
