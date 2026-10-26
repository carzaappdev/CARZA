import 'server-only';
import { createClient } from '@supabase/supabase-js';
import { unstable_cache } from 'next/cache';
import { getVehicleCatalog, type Database } from '@carza/db';
import { clientEnv } from '@/env/client';

/**
 * The make/model catalog. It's public reference data that only changes with a migration, so it's cached
 * across requests (one hour) and read with a cookie-less anonymous client.
 */
export const getCatalog = unstable_cache(
  async () =>
    getVehicleCatalog(
      createClient<Database>(
        clientEnv.NEXT_PUBLIC_SUPABASE_URL,
        clientEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
        { auth: { persistSession: false, autoRefreshToken: false } },
      ),
    ),
  ['vehicle-catalog'],
  { revalidate: 3600 },
);
