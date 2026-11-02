'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { Loader2Icon, LocateFixedIcon, MapPinIcon } from 'lucide-react';
import { toast } from 'sonner';
import { ZIP_COOKIE } from '@/lib/search';

/**
 * "Near Austin, TX" chip that turns into a ZIP field or uses the device's location. Remembers a typed ZIP
 * in the same cookie as search; a device location only lives in the link, rounded to ~1 km.
 */
export function ZipPicker({ label, zip }: { label: string; zip: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(zip ?? '');
  const [locating, setLocating] = useState(false);

  function locate() {
    if (!('geolocation' in navigator)) {
      toast.error('Your browser can’t share a location. Enter a ZIP code instead.');
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        setLocating(false);
        setEditing(false);
        router.push(
          `/events?lat=${coords.latitude.toFixed(2)}&lng=${coords.longitude.toFixed(2)}` as Route,
        );
      },
      () => {
        setLocating(false);
        toast.error('We couldn’t get your location. Enter a ZIP code instead.');
      },
      { maximumAge: 10 * 60 * 1000, timeout: 10_000 },
    );
  }

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="bg-muted hover:bg-accent focus-visible:ring-ring/50 inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-sm font-medium outline-none focus-visible:ring-[3px]"
      >
        <MapPinIcon className="size-4" aria-hidden />
        {label}
      </button>
    );
  }
  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        if (!/^\d{5}$/.test(value)) return;
        const secure = window.location.protocol === 'https:' ? '; secure' : '';
        document.cookie = `${ZIP_COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax${secure}`;
        setEditing(false);
        router.push(`/events?zip=${value}` as Route);
      }}
    >
      <label htmlFor="events-zip" className="sr-only">
        ZIP code
      </label>
      <input
        id="events-zip"
        autoFocus
        inputMode="numeric"
        maxLength={5}
        placeholder="ZIP code"
        value={value}
        onChange={(e) => setValue(e.target.value.replace(/\D/g, ''))}
        className="bg-background focus-visible:ring-ring/50 h-9 w-28 rounded-full border px-3 text-sm outline-none focus-visible:ring-[3px]"
      />
      <button
        type="submit"
        className="bg-primary text-primary-foreground h-9 rounded-full px-3 text-sm font-medium disabled:opacity-50"
        disabled={!/^\d{5}$/.test(value)}
      >
        Go
      </button>
      <button
        type="button"
        onClick={locate}
        disabled={locating}
        className="hover:bg-accent focus-visible:ring-ring/50 inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-sm font-medium outline-none focus-visible:ring-[3px] disabled:opacity-50"
      >
        {locating ? (
          <Loader2Icon className="size-4 animate-spin" aria-hidden />
        ) : (
          <LocateFixedIcon className="size-4" aria-hidden />
        )}
        Use my location
      </button>
    </form>
  );
}
