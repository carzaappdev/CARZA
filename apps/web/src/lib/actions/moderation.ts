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
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

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
 * Moves files out of the public buckets into the private evidence bucket, so nobody can open them by
 * link while they're kept for the legal hold. Needs the secret key: no user, admin or not, can write
 * to that bucket.
 */
async function preserveFiles(reportId: string, files: { bucket: string; path: string }[]) {
  const admin = createAdminClient();
  if (!admin) return files.length === 0;
  let ok = true;
  for (const { bucket, path } of files) {
    const { error } = await admin.storage
      .from(bucket)
      .move(path, `${reportId}/${bucket}/${path}`, { destinationBucket: 'evidence' });
    // Already moved or already gone is fine; anything else needs a person to look.
    if (error && !/not.?found/i.test(error.message)) {
      console.error('preserveFiles failed', { reportId, bucket, message: error.message });
      ok = false;
    }
  }
  return ok;
}

/**
 * Admins only (the database functions check the role again). See REPORT_DECISIONS for what each
 * decision does. A decision closes every open report on the same thing.
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
  } else if (decision === 'suspend' || decision === 'escalate') {
    const owner = ownerOf(report.target_type, report.target_id, snapshot);
    if (!owner) return fail('NOT_FOUND', 'Couldn’t tell whose this is. The account may be gone.');
    const { error } = await supabase.rpc('admin_set_suspended', {
      p_user_id: owner,
      p_action: decision,
      p_reason: report.reason,
      p_note: `Report ${report.id}`,
    });
    if (error) {
      if (error.code === '42501') return fail('FORBIDDEN', 'Admin accounts can’t be suspended.');
      if (error.code === 'P0002') return fail('NOT_FOUND', 'That account no longer exists.');
      console.error('resolveReport suspend failed', { code: error.code, reportId: report.id });
      return fail('INTERNAL', 'Couldn’t suspend the account. Try again.');
    }
    if (
      decision === 'escalate' &&
      !(await preserveFiles(report.id, filesOf(report.target_type, snapshot)))
    ) {
      warning =
        'The account is suspended, but the files couldn’t be moved out of public storage. Move them by hand now.';
    }
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
  return warning ? fail('INTERNAL', warning) : ok(null);
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
