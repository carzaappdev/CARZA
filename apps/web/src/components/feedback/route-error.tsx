'use client';

import { TriangleAlertIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';

/**
 * Body of every segment's error.tsx, so a failure keeps the surrounding header or sidebar.
 * Never renders error.message: it may contain internals. The digest lets support find the server log.
 */
export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      role="alert"
      className="mx-auto flex min-h-[50dvh] max-w-md flex-col items-center justify-center gap-3 px-4 text-center"
    >
      <TriangleAlertIcon className="text-destructive size-8" aria-hidden />
      <h1 className="font-display text-2xl font-semibold">Something went wrong</h1>
      <p className="text-muted-foreground">
        Please try again. If it keeps happening, contact support.
      </p>
      {error.digest ? (
        <p className="text-muted-foreground text-xs">Reference: {error.digest}</p>
      ) : null}
      <Button type="button" onClick={reset} className="mt-2">
        Try again
      </Button>
    </div>
  );
}
