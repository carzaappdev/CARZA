'use server';

import { redirect } from 'next/navigation';
import {
  deleteAccountSchema,
  deleteConfirmationMatches,
  fail,
  type ActionResult,
} from '@carza/shared';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/** Buckets where a user's files live under `{user_id}/`. Each has an owner-delete policy. */
const USER_BUCKETS = ['avatars', 'post-photos', 'reels'] as const;

/** Permanently deletes the signed-in user's account, files and everything they posted. */
export async function deleteAccount(input: unknown): Promise<ActionResult<never>> {
  const parsed = deleteAccountSchema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION', 'That request wasn’t valid.');
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in first.');

  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('username')
    .eq('id', user.id)
    .single();
  if (!profile || !deleteConfirmationMatches(parsed.data.confirm, profile.username)) {
    return fail('VALIDATION', 'Type your username to confirm.', {
      confirm: ['That doesn’t match your username.'],
    });
  }

  // Files first, while the session can still prove they're the owner's.
  for (const bucket of USER_BUCKETS) {
    const store = supabase.storage.from(bucket);
    // Bounded: at most 5,000 files per bucket, so a stuck listing can't spin forever.
    for (let page = 0; page < 50; page++) {
      const { data: files, error } = await store.list(user.id, { limit: 100 });
      if (error || !files.length) break;
      const { error: removeError } = await store.remove(files.map((f) => `${user.id}/${f.name}`));
      if (removeError) {
        console.error('deleteAccount: file cleanup failed', { bucket, userId: user.id });
        break;
      }
    }
  }

  const { error } = await supabase.rpc('delete_my_account');
  if (error) {
    console.error('deleteAccount failed', { code: error.code, userId: user.id });
    return fail('INTERNAL', 'Couldn’t delete your account. Try again.');
  }
  await supabase.auth.signOut({ scope: 'local' });
  redirect('/');
}

/** Signs this account out on every device, including this one. */
export async function signOutEverywhere() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: 'global' });
  redirect('/sign-in');
}
