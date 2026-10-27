'use server';

import { revalidatePath } from 'next/cache';
import { fail, ok, updateProfileSchema, type ActionResult } from '@carza/shared';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function updateProfile(input: unknown): Promise<ActionResult<{ username: string }>> {
  const parsed = updateProfileSchema.safeParse(input);
  if (!parsed.success) {
    return fail(
      'VALIDATION',
      'Check the highlighted fields.',
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in first.');

  const { displayName, username, bio, avatarPath } = parsed.data;
  if (avatarPath && !avatarPath.startsWith(`${user.id}/`))
    return fail('FORBIDDEN', 'That photo isn’t yours.');

  const supabase = await createClient();
  const { data: before } = await supabase
    .from('profiles')
    .select('avatar_path')
    .eq('id', user.id)
    .single();
  const { error } = await supabase
    .from('profiles')
    .update({ display_name: displayName, username, bio: bio || null, avatar_path: avatarPath })
    .eq('id', user.id);
  if (error) {
    if (error.code === '23505') {
      return fail('CONFLICT', 'That username is taken.', { username: ['That username is taken.'] });
    }
    console.error('updateProfile failed', { code: error.code, userId: user.id });
    return fail('INTERNAL', 'Couldn’t save your profile. Try again.');
  }
  // Drop the old avatar file so replaced photos don't linger on the CDN.
  if (before?.avatar_path && before.avatar_path !== avatarPath) {
    await supabase.storage.from('avatars').remove([before.avatar_path]);
  }
  revalidatePath('/', 'layout');
  return ok({ username });
}
