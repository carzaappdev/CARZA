import type { Metadata } from 'next';
import { WifiOffIcon } from 'lucide-react';
import { RetryButton } from './retry-button';

export const metadata: Metadata = { title: 'You’re offline', robots: { index: false } };
export const dynamic = 'force-static';

/** Cached by the service worker and shown when a page can't load without a connection. */
export default function OfflinePage() {
  return (
    <main className="grid min-h-dvh place-items-center p-6 text-center">
      <div className="flex max-w-sm flex-col items-center gap-4">
        <span className="bg-muted grid size-16 place-items-center rounded-full">
          <WifiOffIcon className="text-muted-foreground size-7" aria-hidden />
        </span>
        <h1 className="font-display text-2xl font-bold tracking-tight">You’re offline</h1>
        <p className="text-muted-foreground">
          Carza needs a connection to load the latest posts, reels and events. Check your signal and
          try again.
        </p>
        <RetryButton />
      </div>
    </main>
  );
}
