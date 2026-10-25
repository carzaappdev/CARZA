'use client';

import { useState } from 'react';
import { authErrorMessage } from '@carza/shared';
import { createClient } from '@/lib/supabase/browser';
import { FormMessage } from './fields';

const PROVIDERS = [
  { id: 'google', label: 'Continue with Google' },
  { id: 'apple', label: 'Continue with Apple' },
] as const;

export function OAuthButtons({ next }: { next: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function signIn(provider: (typeof PROVIDERS)[number]['id']) {
    setPending(provider);
    setError(null);
    const { error } = await createClient().auth.signInWithOAuth({
      provider,
      // `next` is already validated by safeNextPath on the server; the callback re-validates it.
      options: {
        redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
    if (error) {
      setError(authErrorMessage(error.code));
      setPending(null);
    }
  }

  return (
    <>
      <div className="flex flex-col gap-2">
        {PROVIDERS.map((p) => (
          <button
            key={p.id}
            type="button"
            disabled={pending !== null}
            onClick={() => signIn(p.id)}
            className="border-input hover:bg-accent h-11 rounded-md border font-medium disabled:opacity-60"
          >
            {pending === p.id ? 'Redirecting…' : p.label}
          </button>
        ))}
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      </div>
      <div className="text-muted-foreground flex items-center gap-3 text-xs uppercase">
        <span className="bg-border h-px flex-1" />
        or
        <span className="bg-border h-px flex-1" />
      </div>
    </>
  );
}
