import type { MetadataRoute } from 'next';
import { clientEnv } from '@/env/client';
import { createClient } from '@/lib/supabase/server';

/** The three tabs plus every upcoming event, so new meets show up in search quickly. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const url = (path: string) => new URL(path, clientEnv.NEXT_PUBLIC_SITE_URL).toString();
  const supabase = await createClient();
  const { data: events } = await supabase
    .from('events')
    .select('id, updated_at')
    .is('cancelled_at', null)
    .gte('starts_at', new Date().toISOString())
    .order('starts_at')
    .limit(1000);

  return [
    { url: url('/'), changeFrequency: 'hourly', priority: 1 },
    { url: url('/reels'), changeFrequency: 'hourly', priority: 0.8 },
    { url: url('/events'), changeFrequency: 'hourly', priority: 0.9 },
    ...(events ?? []).map((e) => ({
      url: url(`/events/${e.id}`),
      lastModified: e.updated_at,
      changeFrequency: 'daily' as const,
      priority: 0.7,
    })),
  ];
}
