'use server';

import { revalidatePath } from 'next/cache';
import {
  fail,
  ok,
  resolveReportSchema,
  setFeaturedSchema,
  setSuspendedSchema,
  type ActionResult,
} from '@carza/shared';
import { getUser, isAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { preserveUserFiles, removeFiles, removeUserFiles } from '@/lib/user-files';

const REMOVABLE = ['post', 'reel', 'event', 'message'] as const;
type Snapshot = Record<string, unknown>;

/** Whose content a report is about, from the snapshot the database took when it was filed. */
function ownerOf(targetType: string, targetId: string, snapshot: Snapshot): string | null {
  if (targetType === 'user') return targetId;
  const key = { post: 'author_id', reel: 'author_id', event: 'host_id', message: 'sender_id' }[
    targetType
  ];
  const id = key ? snapshot[key] : null;
  return typeof id === 'string' ? id : null;
}

/** The public files behind a reported post or reel. */
function filesOf(targetType: string, snapshot: Snapshot): { bucket: string; path: string }[] {
  if (targetType === 'reel') {
    return [snapshot.video_path, snapshot.poster_path]
      .filter((p): p is string => typeof p === 'string')
      .map((path) => ({ bucket: 'reels', path }));
  }
  if (targetType === 'post' && Array.isArray(snapshot.photos)) {
    return snapshot.photos
      .map((photo) =>
        photo && typeof photo === 'object' ? (photo as { path?: unknown }).path : photo,
      )
      .filter((p): p is string => typeof p === 'string')
      .map((path) => ({ bucket: 'post-photos', path }));
  }
  return [];
}

/**
 * Admins only (the database functions check the role again). See REPORT_DECISIONS for what each
 * decision does. A decision closes every open report on the same thing.
 */
export async function resolveReport(
  input: unknown,
): Promise<ActionResult<{ info: string | null }>> {
  const parsed = resolveReportSchema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION', 'That request wasn’t valid.');
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in first.');
  if (!(await isAdmin())) return fail('FORBIDDEN', 'Only admins can do that.');

  const supabase = await createClient();
  const { data: report, error: readError } = await supabase
    .from('reports')
    .select('id, target_type, target_id, reason, target_snapshot')
    .eq('id', parsed.data.reportId)
    .maybeSingle();
  if (readError || !report) return fail('NOT_FOUND', 'That report is gone.');

  const { decision } = parsed.data;
  const snapshot = (
    report.target_snapshot && typeof report.target_snapshot === 'object'
      ? report.target_snapshot
      : {}
  ) as Snapshot;
  let warning: string | null = null;
  let info: string | null = null;

  const owner = ownerOf(report.target_type, report.target_id, snapshot);

  if (decision === 'remove') {
    if (!(REMOVABLE as readonly string[]).includes(report.target_type))
      return fail('VALIDATION', 'That can’t be removed. Suspend the account instead.');
    const { error } = await supabase.rpc('admin_remove_content', {
      p_target_type: report.target_type,
      p_target_id: report.target_id,
      p_reason: report.reason,
    });
    if (error) {
      console.error('resolveReport remove failed', { code: error.code, reportId: report.id });
      return fail('INTERNAL', 'Couldn’t remove it. Try again.');
    }
    // The row is gone; the photos and video must go too, or the old links keep working.
    if (!(await removeFiles(filesOf(report.target_type, snapshot)))) {
      warning =
        'Removed, but its files couldn’t be deleted from storage. Delete them by hand now: the old links still work.';
    }
  } else if (decision === 'suspend' || decision === 'escalate') {
    if (decision === 'escalate') {
      // Any open report on this thing may be the child-safety one, not just the oldest.
      const { count } = await supabase
        .from('reports')
        .select('id', { count: 'exact', head: true })
        .eq('target_type', report.target_type)
        .eq('target_id', report.target_id)
        .eq('reason', 'child_safety')
        .in('status', ['open', 'reviewing']);
      if (!count) return fail('VALIDATION', 'Escalate is for child safety reports.');
    }
    if (!owner) return fail('NOT_FOUND', 'Couldn’t tell whose this is. The account may be gone.');
    const { error } = await supabase.rpc('admin_set_suspended', {
      p_user_id: owner,
      p_action: decision,
      p_reason: decision === 'escalate' ? 'child_safety' : report.reason,
      p_note: `Report ${report.id}`,
    });
    if (error) {
      if (error.code === '42501') return fail('FORBIDDEN', 'Admin accounts can’t be suspended.');
      if (error.code === 'P0002') return fail('NOT_FOUND', 'That account no longer exists.');
      console.error('resolveReport suspend failed', { code: error.code, reportId: report.id });
      return fail('INTERNAL', 'Couldn’t suspend the account. Try again.');
    }
    if (decision === 'escalate') {
      // Everything the account uploaded leaves public storage, not just the reported item.
      const { moved, ok: allMoved } = await preserveUserFiles(owner, report.id);
      if (!allMoved) {
        warning = `The account is suspended, but only ${moved} of its files could be moved out of public storage. Move the rest by hand now.`;
      } else {
        info = `Account suspended and ${moved} ${moved === 1 ? 'file' : 'files'} kept as evidence.`;
      }
    }
  } else if (decision === 'delete_account') {
    if (report.target_type !== 'user')
      return fail('VALIDATION', 'Only a reported account can be deleted here.');
    const { error } = await supabase.rpc('admin_delete_account', {
      p_user_id: report.target_id,
      p_note: `Report ${report.id}`,
    });
    if (error) {
      if (error.code === '42501') return fail('FORBIDDEN', 'Admin accounts can’t be deleted here.');
      if (error.code === 'P0002') return fail('NOT_FOUND', 'That account no longer exists.');
      console.error('resolveReport delete failed', { code: error.code, reportId: report.id });
      return fail('INTERNAL', 'Couldn’t delete the account. Try again.');
    }
    await removeUserFiles(report.target_id);
  }

  const { error } = await supabase
    .from('reports')
    .update({
      status: decision === 'dismiss' ? 'dismissed' : 'resolved',
      resolved_by: user.id,
      resolved_at: new Date().toISOString(),
    })
    .eq('target_type', report.target_type)
    .eq('target_id', report.target_id)
    .in('status', ['open', 'reviewing']);
  if (error) return fail('INTERNAL', 'Couldn’t update the report.');
  revalidatePath('/account/reports');
  return warning ? fail('INTERNAL', warning) : ok({ info });
}

/** Admins only: lift (or apply) a suspension from the suspended-accounts list. */
export async function setSuspended(input: unknown): Promise<ActionResult<null>> {
  const parsed = setSuspendedSchema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION', 'That request wasn’t valid.');
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in first.');
  if (!(await isAdmin())) return fail('FORBIDDEN', 'Only admins can do that.');
  const { error } = await (
    await createClient()
  ).rpc('admin_set_suspended', {
    p_user_id: parsed.data.userId,
    p_action: parsed.data.suspended ? 'suspend' : 'unsuspend',
  });
  if (error) {
    console.error('setSuspended failed', { code: error.code, userId: user.id });
    return fail('INTERNAL', 'Couldn’t update the account. Try again.');
  }
  revalidatePath('/account/reports');
  return ok(null);
}

/** Admins only: feature someone in "who to follow" (the database checks the role too). */
export async function setFeatured(input: unknown): Promise<ActionResult<{ featured: boolean }>> {
  const parsed = setFeaturedSchema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION', 'That request wasn’t valid.');
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in first.');
  if (!(await isAdmin())) return fail('FORBIDDEN', 'Only admins can do that.');
  const { userId, featured } = parsed.data;
  const { error } = await (
    await createClient()
  ).rpc('set_featured', {
    p_user_id: userId,
    p_featured: featured,
  });
  if (error) {
    console.error('setFeatured failed', { code: error.code, userId: user.id });
    return fail('INTERNAL', 'Couldn’t update. Try again.');
  }
  revalidatePath('/u/[username]', 'page');
  return ok({ featured });
}
