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
  const [{ data: profile }, { data: age, error: ageError }] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name, username, avatar_path, role')
      .eq('id', user.id)
      .maybeSingle(),
    supabase.rpc('my_age_group'),
  ]);
  // A sign-up trigger creates the profile, so a missing row is a bug. Log it, but keep the header (and so
  // every page) rendering rather than failing the whole site for this user.
  if (ageError) console.error('Age group lookup failed', { code: ageError.code, userId: user.id });
  if (!profile) console.error('Profile missing for signed-in user', { userId: user.id });
  return {
    id: user.id,
    avatarPath: profile?.avatar_path ?? null,
    displayName: profile?.display_name ?? 'Your account',
    username: profile?.username ?? null,
    isAdmin: profile?.role === 'admin',
    /** Null until they've given a date of birth (the app shell sends them to /age first). */
    // If the lookup itself failed, don't bounce everyone to /age: fall back to the stricter teen view.
    ageGroup: (ageError
      ? 'teen'
      : age === 'teen' || age === 'adult'
        ? age
        : null) as AgeGroup | null,
  };
});

export type Viewer = NonNullable<Awaited<ReturnType<typeof getViewer>>>;
