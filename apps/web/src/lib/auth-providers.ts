import 'server-only';
import { clientEnv } from '@/env/client';

export type OAuthProvider = 'google' | 'apple';
const ALL: OAuthProvider[] = ['google', 'apple'];

/**
 * Social sign-in options that are switched on in Supabase Auth, so we never show a button that ends on
 * Supabase's raw "provider is not enabled" JSON. Reads the public settings endpoint (no secrets) and
 * caches it for 5 minutes, so enabling a provider in the dashboard shows its button shortly after.
 * If the lookup fails we show every option rather than hide a working one.
 */
export async function enabledOAuthProviders(): Promise<OAuthProvider[]> {
  try {
    const res = await fetch(`${clientEnv.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: clientEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY },
      next: { revalidate: 300 },
      signal: AbortSignal.timeout(3000),
    });
    if (!res.ok) return ALL;
    const body = (await res.json()) as { external?: Partial<Record<string, boolean>> };
    return ALL.filter((p) => body.external?.[p] === true);
  } catch {
    return ALL;
  }
}
