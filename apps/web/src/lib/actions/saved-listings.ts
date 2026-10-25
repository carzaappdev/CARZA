'use server';

import { revalidatePath } from 'next/cache';
import { fail, ok, setListingSavedSchema, type ActionResult } from '@carza/shared';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/** Saves or unsaves a listing for the signed-in user. RLS only allows their own rows on visible listings. */
export async function setListingSaved(input: unknown): Promise<ActionResult<{ saved: boolean }>> {
  const parsed = setListingSavedSchema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION', 'That request wasn’t valid.');
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in to save cars.');

  const { listingId, saved } = parsed.data;
  const supabase = await createClient();
  const { error } = saved
    ? await supabase
        .from('saved_listings')
        .upsert(
          { user_id: user.id, listing_id: listingId },
          { onConflict: 'user_id,listing_id', ignoreDuplicates: true },
        )
    : await supabase
        .from('saved_listings')
        .delete()
        .eq('user_id', user.id)
        .eq('listing_id', listingId);

  if (error) {
    console.error('setListingSaved failed', { code: error.code, userId: user.id });
    return fail(
      error.code === '42501' ? 'FORBIDDEN' : 'INTERNAL',
      'Couldn’t update your saved cars. Try again.',
    );
  }
  revalidatePath('/account/saved');
  return ok({ saved });
}
