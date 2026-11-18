'use client';

import { useState, useSyncExternalStore } from 'react';
import { authErrorMessage } from '@carza/shared';
import { isNativeApp, NATIVE_AUTH_REDIRECT, openInAppBrowser } from '@/lib/native';
import { createClient } from '@/lib/supabase/browser';
import { FormMessage } from './fields';
import { AppleIcon, GoogleIcon } from './provider-icons';

// Styling follows each provider's sign-in button guidelines:
// Google: white button, gray outline, colored "G" (dark theme: #131314 fill, #8E918F outline).
// Apple: black button, white logo (dark theme: white button, black logo).
const PROVIDERS = [
  {
    id: 'google',
    label: 'Continue with Google',
    Icon: GoogleIcon,
    className:
      'border border-[#dadce0] bg-white text-[#1F1F1F] hover:border-[#747775] hover:bg-[#F8F9FA] dark:border-[#8E918F] dark:bg-[#131314] dark:text-[#E3E3E3] dark:hover:bg-[#1f1f21]',
  },
  {
    id: 'apple',
    label: 'Continue with Apple',
    Icon: AppleIcon,
    className:
      'bg-black text-white hover:bg-black/85 dark:bg-white dark:text-black dark:hover:bg-white/90',
  },
] as const;

const noop = () => () => {};

/** Renders only the providers switched on in Supabase (see enabledOAuthProviders); nothing if none are. */
export function OAuthButtons({
  next,
  providers,
}: {
  next: string;
  providers: readonly (typeof PROVIDERS)[number]['id'][];
}) {
  const native = useSyncExternalStore(noop, isNativeApp, () => false);
  // App Store rule 4.8: an app that offers Google sign-in must offer Sign in with Apple too.
  const shown = PROVIDERS.filter(
    (p) =>
      providers.includes(p.id) && !(native && p.id === 'google' && !providers.includes('apple')),
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<string | null>(null);

  async function signIn(provider: (typeof PROVIDERS)[number]['id']) {
    setPending(provider);
    setError(null);
    // `next` is already validated by safeNextPath on the server; the callback re-validates it.
    const query = `?next=${encodeURIComponent(next)}`;
    // In the iPhone app the provider page opens in the in-app Safari sheet (Google refuses embedded
    // web views) and comes back through the app's URL scheme; NativeBridge finishes it here.
    const { data, error } = await createClient().auth.signInWithOAuth({
      provider,
      options: native
        ? { redirectTo: `${NATIVE_AUTH_REDIRECT}${query}`, skipBrowserRedirect: true }
        : { redirectTo: `${window.location.origin}/auth/callback${query}` },
    });
    if (!error && native && data.url) {
      await openInAppBrowser(data.url).catch(() => setError(authErrorMessage(undefined)));
      setPending(null);
      return;
    }
    if (error) {
      setError(authErrorMessage(error.code));
      setPending(null);
    }
  }

  if (!shown.length) return null;

  return (
    <>
      <div className="flex flex-col gap-2">
        {shown.map((p) => (
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
