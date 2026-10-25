import { createBrowserClient } from '@supabase/ssr';
import type { Database } from '@carza/db';
import { clientEnv } from '@/env/client';
import { SESSION_COOKIE_OPTIONS } from './cookie-options';

/** Browser client: auth calls (so Supabase's per-IP limits see the real user IP), Realtime, signed uploads. */
export function createClient() {
  return createBrowserClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    { cookieOptions: SESSION_COOKIE_OPTIONS },
  );
}
