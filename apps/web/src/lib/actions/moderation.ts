'use server';

import { revalidatePath } from 'next/cache';
import { fail, ok, resolveReportSchema, type ActionResult } from '@carza/shared';
import { getUser, isAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

const REMOVABLE = { post: 'posts', reel: 'reels', event: 'events' } as const;

/**
 * Admins only. "remove" deletes the reported post, reel or event (RLS lets admins delete them) and
 * resolves every open report on it; "dismiss" closes this report.
 */
export async function resolveReport(input: unknown): Promise<ActionResult<null>> {
  const parsed = resolveReportSchema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION', 'That request wasn’t valid.');
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in first.');
  if (!(await isAdmin())) return fail('FORBIDDEN', 'Only admins can do that.');

  const supabase = await createClient();
  const { data: report, error: readError } = await supabase
    .from('reports')
    .select('id, target_type, target_id')
    .eq('id', parsed.data.reportId)
    .maybeSingle();
  if (readError || !report) return fail('NOT_FOUND', 'That report is gone.');

  const resolved = { resolved_by: user.id, resolved_at: new Date().toISOString() };
  if (parsed.data.decision === 'dismiss') {
    const { error } = await supabase
      .from('reports')
      .update({ status: 'dismissed', ...resolved })
      .eq('id', report.id);
    if (error) return fail('INTERNAL', 'Couldn’t update the report.');
  } else {
    const table =
      report.target_type in REMOVABLE
        ? REMOVABLE[report.target_type as keyof typeof REMOVABLE]
        : null;
    if (table) {
      const { error } = await supabase.from(table).delete().eq('id', report.target_id);
      if (error) {
        console.error('resolveReport delete failed', { code: error.code, reportId: report.id });
        return fail('INTERNAL', 'Couldn’t remove it. Try again.');
      }
    }
    const { error } = await supabase
      .from('reports')
      .update({ status: 'resolved', ...resolved })
      .eq('target_type', report.target_type)
      .eq('target_id', report.target_id)
      .in('status', ['open', 'reviewing']);
    if (error) return fail('INTERNAL', 'Couldn’t update the report.');
  }
  revalidatePath('/account/reports');
  return ok(null);
}
