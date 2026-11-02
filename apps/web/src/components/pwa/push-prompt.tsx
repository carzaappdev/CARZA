'use client';

import { useEffect, useState, useTransition } from 'react';
import { BellRingIcon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { currentSubscription, enablePush, pushSupport } from '@/lib/push-client';

const DISMISSED = 'carza:push-prompt-dismissed';

/** A one-tap “turn on alerts” card at the top of Notifications, until it's on or dismissed. */
export function PushPrompt() {
  const [show, setShow] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    try {
      if (localStorage.getItem(DISMISSED)) return;
    } catch {
      // Storage blocked: still offer it.
    }
    if (pushSupport() !== 'supported' || Notification.permission === 'denied') return;
    void currentSubscription().then((sub) => {
      if (!sub || Notification.permission !== 'granted') setShow(true);
    });
  }, []);

  if (!show) return null;

  const dismiss = () => {
    setShow(false);
    try {
      localStorage.setItem(DISMISSED, '1');
    } catch {
      // Fine: it just shows again next time.
    }
  };

  return (
    <div className="bg-primary/[0.06] flex items-center gap-3 border-b px-4 py-3">
      <BellRingIcon className="text-primary size-5 shrink-0" aria-hidden />
      <p className="min-w-0 flex-1 text-sm">Get alerts on this device when something happens.</p>
      <Button
        size="sm"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const error = await enablePush();
            if (error) toast.error(error);
            else {
              toast.success('Alerts are on.');
              setShow(false);
            }
          })
        }
      >
        Turn on
      </Button>
      <Button size="icon" variant="ghost" aria-label="Not now" onClick={dismiss}>
        <XIcon aria-hidden />
      </Button>
    </div>
  );
}
