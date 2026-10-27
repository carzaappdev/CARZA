import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@carza/db';
import { clientEnv } from '@/env/client';
import { serverEnv } from '@/env/server';

/**
 * Secret-key client. Bypasses RLS, so it's used for one thing only: signing an upload URL for a path the
 * user already reserved (as themselves) through reserve_upload. Null when the key isn't configured.
 */
export function createAdminClient() {
  const key = serverEnv.SUPABASE_SECRET_KEY;
  if (!key) return null;
  return createClient<Database>(clientEnv.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
