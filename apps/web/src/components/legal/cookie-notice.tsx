'use client';

import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { Button } from '@/components/ui/button';

const KEY = 'carza:cookie-notice';
const listeners = new Set<() => void>();

function read() {
  try {
    return localStorage.getItem(KEY) === 'ok';
  } catch {
    return true; // Storage blocked: don't nag on every page.
  }
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/**
 * Carza only sets essential cookies (sign-in session, remembered ZIP), so this is a notice, not a consent
 * prompt. Shown once per browser; hidden during server render so it never flashes for returning people.
 */
export function CookieNotice() {
  const dismissed = useSyncExternalStore(subscribe, read, () => true);
  if (dismissed) return null;
  const dismiss = () => {
    try {
      localStorage.setItem(KEY, 'ok');
    } catch {
      // Storage blocked: it'll show again next visit, which is fine.
    }
    listeners.forEach((cb) => cb());
  };
  return (
    <div
      role="region"
      aria-label="Cookie notice"
      className="bg-popover text-popover-foreground fixed inset-x-3 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-50 mx-auto flex max-w-xl items-center gap-3 rounded-2xl border p-3 pl-4 text-sm shadow-lg md:bottom-4"
    >
      <p className="flex-1">
        Carza uses only essential cookies to keep you signed in and remember your area. No ads, no
        tracking.{' '}
        <Link href="/privacy" className="font-semibold underline underline-offset-4">
          Privacy
        </Link>
      </p>
      <Button size="sm" className="rounded-full" onClick={dismiss}>
        Got it
      </Button>
    </div>
  );
}
