'use client';

import { useState } from 'react';
import { authErrorMessage } from '@carza/shared';
import { createClient } from '@/lib/supabase/browser';
import { FormMessage } from './fields';
import { AppleIcon, GoogleIcon } from './provider-icons';

// Styling follows each provider's sign-in button guidelines:
// Google: white button, gray outline, colored "G". Apple: black button, white Apple logo.
const PROVIDERS = [
  {
    id: 'google',
    label: 'Continue with Google',
    Icon: GoogleIcon,
    className:
      'border border-[#dadce0] bg-white text-[#1F1F1F] hover:border-[#747775] hover:bg-[#F8F9FA]',
  },
  {
    id: 'apple',
    label: 'Continue with Apple',
    Icon: AppleIcon,
    className: 'bg-black text-white hover:bg-black/85',
  },
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
            className={`focus-visible:ring-ring flex h-12 items-center justify-center gap-3 rounded-xl px-4 font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 ${p.className}`}
          >
            <p.Icon />
            <span>{pending === p.id ? 'Redirecting…' : p.label}</span>
          </button>
        ))}
        {error ? <FormMessage tone="error">{error}</FormMessage> : null}
      </div>
      <div className="text-muted-foreground flex items-center gap-3 text-xs tracking-wider uppercase">
        <span className="bg-border h-px flex-1" />
        or
        <span className="bg-border h-px flex-1" />
      </div>
    </>
  );
}
