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
import { removeUserFiles } from '@/lib/user-files';

/** Buckets where a user's files live under `{user_id}/`. */

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

  // The account goes first, so a failure here never leaves someone with their photos gone but their
  // account still there.
  const { error } = await supabase.rpc('delete_my_account');
  if (error) {
    console.error('deleteAccount failed', { code: error.code, userId: user.id });
    return fail('INTERNAL', 'Couldn’t delete your account. Try again.');
  }

  // Then their files.
  await removeUserFiles(user.id);
  await supabase.auth.signOut({ scope: 'local' });
  redirect('/');
}

/** Signs this account out on every device, including this one. */
export async function signOutEverywhere() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: 'global' });
  redirect('/sign-in');
}
