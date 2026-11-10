import 'server-only';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@carza/db';
import { clientEnv } from '@/env/client';
import { serverEnv } from '@/env/server';

/**
 * Secret-key client. Bypasses RLS, so it's used for five things only: signing an upload URL for a path
 * the user already reserved (as themselves) through reserve_upload, removing a deleted account's own
 * `{user_id}/` files, delivering push alerts when the database calls the dispatch route (no user
 * session there), and moving an escalated report's files into the private evidence bucket (after the
 * caller is confirmed as an admin), plus filing a request from the public legal forms, whose limit is
 * keyed on the sender's address. Null when the key isn't configured.
 */
export function createAdminClient() {
  const key = serverEnv.SUPABASE_SECRET_KEY;
  if (!key) return null;
  return createClient<Database>(clientEnv.NEXT_PUBLIC_SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
