'use client';

import { useEffect, useState, useSyncExternalStore, useTransition } from 'react';
import { toast } from 'sonner';
import { PUSH_CATEGORIES, type PushCategory } from '@carza/shared';
import { Switch } from '@/components/ui/switch';
import { savePushPreferences } from '@/lib/actions/push';
import {
  currentSubscription,
  disablePush,
  enablePush,
  pushSupport,
  type PushSupport,
} from '@/lib/push-client';

const noop = () => () => {};

/** Settings → Notifications: alerts on this device, and which kinds to send. */
export function PushSettings({ initialMuted }: { initialMuted: PushCategory[] }) {
  // Browser-only facts: unknown (null) during the server render.
  const support = useSyncExternalStore<PushSupport | null>(noop, pushSupport, () => null);
  const [enabled, setEnabled] = useState(false);
  const [muted, setMuted] = useState(initialMuted);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (support !== 'supported') return;
    void currentSubscription().then((sub) =>
      setEnabled(Boolean(sub) && Notification.permission === 'granted'),
    );
  }, [support]);

  const toggleDevice = (on: boolean) =>
    startTransition(async () => {
      const error = await (on ? enablePush() : disablePush());
      if (error) toast.error(error);
      else setEnabled(on);
    });

  const toggleCategory = (key: PushCategory, on: boolean) => {
    const previous = muted;
    const next = on ? muted.filter((k) => k !== key) : [...muted, key];
    setMuted(next);
    startTransition(async () => {
      const result = await savePushPreferences({ muted: next });
      if (!result.ok) {
        setMuted(previous);
        toast.error(result.error.message);
      }
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p id="push-device" className="text-sm font-medium">
            Alerts on this device
          </p>
          <p className="text-muted-foreground text-sm">
            {support === 'needs-install'
              ? 'On iPhone and iPad, add Carza to your Home Screen first: tap Share, then “Add to Home Screen”, and open it from there.'
              : support === 'unsupported'
                ? 'This browser doesn’t support alerts. Try Chrome, Edge, Firefox or Safari.'
                : 'Get a notification when people follow you, reply, or RSVP to your events.'}
          </p>
        </div>
        <Switch
          aria-labelledby="push-device"
          checked={enabled}
          disabled={support !== 'supported' || pending}
          onCheckedChange={toggleDevice}
        />
      </div>
      <fieldset className="flex flex-col gap-3" disabled={pending}>
        <legend className="text-muted-foreground mb-1 text-sm">Send alerts for</legend>
        {PUSH_CATEGORIES.map((c) => (
          <label key={c.key} className="flex items-center justify-between gap-4 text-sm">
            {c.label}
            <Switch
              checked={!muted.includes(c.key)}
              onCheckedChange={(on) => toggleCategory(c.key, on)}
            />
          </label>
        ))}
      </fieldset>
    </div>
  );
}
