import 'server-only';
import { cache } from 'react';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/** The signed-in user's display info for the app shell, or null when signed out. Cached per request. */
export const getViewer = cache(async () => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, username')
    .eq('id', user.id)
    .maybeSingle();
  // A sign-up trigger creates the profile, so a missing row is a bug. Log it, but keep the header (and so
  // every page) rendering rather than failing the whole site for this user.
  if (!profile) console.error('Profile missing for signed-in user', { userId: user.id });
  return {
    displayName: profile?.display_name ?? 'Your account',
    username: profile?.username ?? null,
  };
});

export type Viewer = NonNullable<Awaited<ReturnType<typeof getViewer>>>;
