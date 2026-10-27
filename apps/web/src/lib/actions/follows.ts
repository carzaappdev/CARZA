'use server';

import { revalidatePath } from 'next/cache';
import { fail, ok, setFollowingSchema, type ActionResult } from '@carza/shared';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function setFollowing(input: unknown): Promise<ActionResult<{ following: boolean }>> {
  const parsed = setFollowingSchema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION', 'That request wasn’t valid.');
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in to follow people.');

  const { userId, following } = parsed.data;
  if (userId === user.id) return fail('VALIDATION', 'You can’t follow yourself.');
  const supabase = await createClient();
  const { error } = following
    ? await supabase
        .from('follows')
        .upsert(
          { followee_id: userId },
          { onConflict: 'follower_id,followee_id', ignoreDuplicates: true },
        )
    : await supabase.from('follows').delete().eq('follower_id', user.id).eq('followee_id', userId);
  if (error) {
    if (error.code === 'CZ429')
      return fail('RATE_LIMITED', 'You’re following a lot of people. Try again later.');
    if (error.code === '23503') return fail('NOT_FOUND', 'That account no longer exists.');
    console.error('setFollowing failed', { code: error.code, userId: user.id });
    return fail('INTERNAL', 'Couldn’t update. Try again.');
  }
  revalidatePath('/u/[username]', 'page');
  return ok({ following });
}
