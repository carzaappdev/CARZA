'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { MapPinIcon } from 'lucide-react';
import { ZIP_COOKIE } from '@/lib/search';

/** "Near Austin, TX" chip that turns into a ZIP field. Remembers the ZIP in the same cookie as search. */
export function ZipPicker({ label, zip }: { label: string; zip: string | null }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(zip ?? '');

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
      className="flex items-center gap-2"
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
    </form>
  );
}
