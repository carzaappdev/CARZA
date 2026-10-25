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
  // The profile row is created by a trigger on sign-up, so a missing row is a bug, not a state.
  if (!profile) throw new Error('Profile missing for signed-in user');
  return { id: user.id, displayName: profile.display_name, username: profile.username };
});

export type Viewer = NonNullable<Awaited<ReturnType<typeof getViewer>>>;
