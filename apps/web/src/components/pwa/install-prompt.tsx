'use client';

import Image from 'next/image';
import { useEffect, useState } from 'react';
import { ShareIcon, XIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isIos, isStandalone } from '@/lib/push-client';

const DISMISSED_AT = 'carza:install-dismissed-at';
const VISITS = 'carza:visits';
const SESSION_COUNTED = 'carza:visit-counted';
const SNOOZE_MS = 14 * 24 * 60 * 60_000;

type InstallEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: string }>;
};

/** Counts one visit per browser session and says whether the card may show (from the 2nd visit on). */
function eligible() {
  try {
    if (Date.now() - Number(localStorage.getItem(DISMISSED_AT) ?? 0) < SNOOZE_MS) return false;
    let visits = Number(localStorage.getItem(VISITS) ?? 0);
    if (!sessionStorage.getItem(SESSION_COUNTED)) {
      visits += 1;
      localStorage.setItem(VISITS, String(visits));
      sessionStorage.setItem(SESSION_COUNTED, '1');
    }
    return visits >= 2;
  } catch {
    return false;
  }
}

/**
 * “Add Carza to your home screen”, from the second visit on. Chrome, Edge and Android get a real
 * Install button; iPhone and iPad Safari get the two taps to do it from the Share sheet.
 */
export function InstallPrompt() {
  const [mode, setMode] = useState<'native' | 'ios' | null>(null);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);

  useEffect(() => {
    if (isStandalone() || !eligible()) return;
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as InstallEvent);
      setMode('native');
    };
    const onInstalled = () => setMode(null);
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    // Safari only (other iOS browsers can't add to the Home Screen from a page). Shown after the
    // page settles rather than over the first paint.
    const iosSafari =
      isIos() &&
      /Safari/.test(navigator.userAgent) &&
      !/CriOS|FxiOS|EdgiOS/.test(navigator.userAgent);
    const timer = iosSafari ? window.setTimeout(() => setMode('ios'), 1500) : undefined;
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  if (!mode) return null;

  const dismiss = () => {
    setMode(null);
    try {
      localStorage.setItem(DISMISSED_AT, String(Date.now()));
    } catch {
      // Fine: it just shows again next visit.
    }
  };

  const install = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    const { outcome } = await installEvent.userChoice;
    if (outcome === 'accepted') setMode(null);
    else dismiss();
  };

  return (
    <div
      role="region"
      aria-label="Install Carza"
      className="bg-background animate-in fade-in slide-in-from-bottom-4 fixed inset-x-3 bottom-[calc(4rem+env(safe-area-inset-bottom))] z-40 flex items-center gap-3 rounded-2xl border p-3 shadow-lg md:right-4 md:bottom-4 md:left-auto md:w-[380px]"
    >
      <Image
        src="/icons/icon-192.png"
        alt=""
        width={48}
        height={48}
        className="size-12 shrink-0 rounded-xl"
      />
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-semibold">Get the Carza app</p>
        {mode === 'ios' ? (
          <p className="text-muted-foreground">
            Tap <ShareIcon className="inline size-4 align-[-3px]" aria-label="Share" />, then{' '}
            <span className="text-foreground font-medium">Add to Home Screen</span>.
          </p>
        ) : (
          <p className="text-muted-foreground">Full screen, one tap away, with alerts.</p>
        )}
      </div>
      {mode === 'native' ? (
        <Button size="sm" onClick={() => void install()}>
          Install
        </Button>
      ) : null}
      <Button size="icon" variant="ghost" aria-label="Not now" onClick={dismiss}>
        <XIcon aria-hidden />
      </Button>
    </div>
  );
}
