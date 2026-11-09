import 'server-only';
import { cache } from 'react';
import type { AgeGroup } from '@carza/shared';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/** The signed-in user's display info for the app shell, or null when signed out. Cached per request. */
export const getViewer = cache(async () => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const [{ data: profile }, { data: age }] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name, username, avatar_path, role')
      .eq('id', user.id)
      .maybeSingle(),
    supabase.rpc('my_age_group'),
  ]);
  // A sign-up trigger creates the profile, so a missing row is a bug. Log it, but keep the header (and so
  // every page) rendering rather than failing the whole site for this user.
  if (!profile) console.error('Profile missing for signed-in user', { userId: user.id });
  return {
    id: user.id,
    avatarPath: profile?.avatar_path ?? null,
    displayName: profile?.display_name ?? 'Your account',
    username: profile?.username ?? null,
    isAdmin: profile?.role === 'admin',
    /** Null until they've given a date of birth (the app shell sends them to /age first). */
    ageGroup: age === 'teen' || age === 'adult' ? (age as AgeGroup) : null,
  };
});

export type Viewer = NonNullable<Awaited<ReturnType<typeof getViewer>>>;
