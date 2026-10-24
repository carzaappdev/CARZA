'use client';

// Route-level error boundary. Never renders error.message: it may contain internals.
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex min-h-[60dvh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center">
      <h1 className="text-2xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground">
        Please try again. If it keeps happening, contact support.
      </p>
      {error.digest ? (
        <p className="text-muted-foreground text-xs">Reference: {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={reset}
        className="bg-primary text-primary-foreground rounded-md px-4 py-2 font-medium"
      >
        Try again
      </button>
    </main>
  );
}
