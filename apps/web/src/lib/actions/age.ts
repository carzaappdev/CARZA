'use server';

import { fail, ok, setBirthDateSchema, type ActionResult } from '@carza/shared';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { removeUserFiles } from '@/lib/user-files';

/**
 * Saves the signed-in user's date of birth (once). Under 13, the database deletes the account and this
 * clears the session; the caller then shows the "can't join" screen.
 */
export async function setBirthDate(input: unknown): Promise<ActionResult<{ underAge: boolean }>> {
  const parsed = setBirthDateSchema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION', 'Enter your date of birth.');
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in first.');

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('set_birth_date', {
    p_birth_date: parsed.data.birthDate,
  });
  if (error) {
    if (error.code === '22023') return fail('VALIDATION', 'Enter your date of birth.');
    if (error.code === '42501') return ok({ underAge: false }); // Already on file.
    console.error('setBirthDate failed', { code: error.code, userId: user.id });
    return fail('INTERNAL', 'Couldn’t save that. Try again.');
  }
  if (data === 'under_age') {
    // The account is gone; so are any photos or videos it had uploaded.
    await removeUserFiles(user.id);
    await supabase.auth.signOut({ scope: 'local' });
    return ok({ underAge: true });
  }
  return ok({ underAge: false });
}
