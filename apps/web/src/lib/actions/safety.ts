'use server';

import { revalidatePath } from 'next/cache';
import { fail, ok, reportSchema, setBlockedSchema, type ActionResult } from '@carza/shared';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/** Files a report. The database snapshots the content and only accepts things the reporter can see. */
export async function reportContent(input: unknown): Promise<ActionResult<null>> {
  const parsed = reportSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION', parsed.error.issues[0]?.message ?? 'That report isn’t valid.');
  }
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in to report.');

  const { targetType, targetId, reason, details } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.from('reports').insert({
    target_type: targetType,
    target_id: targetId,
    reason,
    details: details || null,
  });
  if (error) {
    // Already reported: treat as success so the person isn't told to try again.
    if (error.code === '23505') return ok(null);
    if (error.code === 'CZ429') return fail('RATE_LIMITED', 'You’ve sent a lot of reports today.');
    if (error.code === '42501') return fail('NOT_FOUND', 'That’s no longer available.');
    console.error('reportContent failed', { code: error.code, userId: user.id });
    return fail('INTERNAL', 'Couldn’t send the report. Try again.');
  }
  return ok(null);
}

/** Blocks or unblocks someone. Blocking also removes follows between you (the database does that). */
export async function setBlocked(input: unknown): Promise<ActionResult<{ blocked: boolean }>> {
  const parsed = setBlockedSchema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION', 'That request wasn’t valid.');
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in first.');

  const { userId, blocked } = parsed.data;
  if (userId === user.id) return fail('VALIDATION', 'You can’t block yourself.');
  const supabase = await createClient();
  const { error } = blocked
    ? await supabase
        .from('blocks')
        .upsert(
          { blocked_id: userId },
          { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true },
        )
    : await supabase.from('blocks').delete().eq('blocker_id', user.id).eq('blocked_id', userId);
  if (error) {
    if (error.code === 'CZ429') return fail('RATE_LIMITED', 'Slow down a little and try again.');
    if (error.code === '23503') return fail('NOT_FOUND', 'That account no longer exists.');
    console.error('setBlocked failed', { code: error.code, userId: user.id });
    return fail('INTERNAL', 'Couldn’t update. Try again.');
  }
  revalidatePath('/', 'layout');
  return ok({ blocked });
}
