import 'server-only';
import { cache } from 'react';
import { getVehicleCatalog } from '@carza/db';
import { createClient } from '@/lib/supabase/server';

/** The make/model catalog, fetched once per request. */
export const getCatalog = cache(async () => getVehicleCatalog(await createClient()));
