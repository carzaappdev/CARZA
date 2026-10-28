'use server';

import { revalidatePath } from 'next/cache';
import { getReelComments, getReels, type PostView, type ReelsPage } from '@carza/db';
import {
  createReelSchema,
  fail,
  ok,
  reelCursorSchema,
  recordReelViewSchema,
  reelIdSchema,
  setReelLikedSchema,
  type ActionResult,
} from '@carza/shared';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function createReel(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = createReelSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION', parsed.error.issues[0]?.message ?? 'That reel isn’t valid.');
  }
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in to post reels.');

  const r = parsed.data;
  const supabase = await createClient();
  const bucket = supabase.storage.from('reels');
  for (const path of [r.videoPath, r.posterPath]) {
    if (!path.startsWith(`${user.id}/`)) return fail('FORBIDDEN', 'That file isn’t yours.');
    const { data: exists } = await bucket.exists(path);
    if (!exists) return fail('VALIDATION', 'The upload didn’t finish. Try again.');
  }

  const { data, error } = await supabase
    .from('reels')
    .insert({
      video_path: r.videoPath,
      poster_path: r.posterPath,
      width: r.width,
      height: r.height,
      duration_seconds: Math.round(r.durationSeconds * 100) / 100,
      caption: r.caption,
    })
    .select('id')
    .single();
  if (error) {
    if (error.code === 'CZ429')
      return fail('RATE_LIMITED', 'You’ve posted a lot of reels. Try again later.');
    console.error('createReel failed', { code: error.code, userId: user.id });
    return fail('INTERNAL', 'Couldn’t post the reel. Try again.');
  }
  revalidatePath('/reels');
  return ok({ id: data.id });
}

export async function deleteReel(input: unknown): Promise<ActionResult<null>> {
  const parsed = reelIdSchema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION', 'That request wasn’t valid.');
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in first.');

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('reels')
    .delete()
    .eq('id', parsed.data.reelId)
    .select('video_path, poster_path');
  if (error) {
    console.error('deleteReel failed', { code: error.code, userId: user.id });
    return fail('INTERNAL', 'Couldn’t delete the reel. Try again.');
  }
  const deleted = data[0];
  if (!deleted) return fail('NOT_FOUND', 'That reel is already gone.');
  // Free the storage (and CDN copies). An admin deleting someone else's reel can't touch their folder;
  // those files are orphaned until a cleanup job exists.
  await supabase.storage.from('reels').remove([deleted.video_path, deleted.poster_path]);
  revalidatePath('/reels');
  return ok(null);
}

export async function setReelLiked(input: unknown): Promise<ActionResult<{ liked: boolean }>> {
  const parsed = setReelLikedSchema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION', 'That request wasn’t valid.');
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in to like reels.');

  const { reelId, liked } = parsed.data;
  const supabase = await createClient();
  const { error } = liked
    ? await supabase
        .from('reel_likes')
        .upsert({ reel_id: reelId }, { onConflict: 'reel_id,user_id', ignoreDuplicates: true })
    : await supabase.from('reel_likes').delete().eq('reel_id', reelId).eq('user_id', user.id);
  if (error) {
    if (error.code === 'CZ429') return fail('RATE_LIMITED', 'Slow down a little and try again.');
    if (error.code === '23503') return fail('NOT_FOUND', 'That reel was deleted.');
    console.error('setReelLiked failed', { code: error.code, userId: user.id });
    return fail('INTERNAL', 'Couldn’t update your like. Try again.');
  }
  return ok({ liked });
}

export async function loadReelsPage(input: unknown): Promise<ActionResult<ReelsPage>> {
  const parsed = reelCursorSchema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION', 'That request wasn’t valid.');
  const user = await getUser();
  try {
    return ok(await getReels(await createClient(), parsed.data, user?.id ?? null));
  } catch (e) {
    console.error('loadReelsPage failed', { error: (e as { code?: string }).code });
    return fail('INTERNAL', 'Couldn’t load more reels.');
  }
}

/** Comments for the reel's comment sheet. */
export async function loadReelComments(input: unknown): Promise<ActionResult<PostView[]>> {
  const parsed = reelIdSchema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION', 'That request wasn’t valid.');
  const user = await getUser();
  try {
    return ok(await getReelComments(await createClient(), parsed.data.reelId, user?.id ?? null));
  } catch {
    return fail('INTERNAL', 'Couldn’t load comments.');
  }
}

/** Counts a view once per viewer (guests are identified by a random id their browser keeps). */
export async function recordReelView(input: unknown): Promise<ActionResult<null>> {
  const parsed = recordReelViewSchema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION', 'That request wasn’t valid.');
  const supabase = await createClient();
  const { error } = await supabase.rpc('record_reel_view', {
    p_reel_id: parsed.data.reelId,
    p_guest_id: parsed.data.guestId ?? undefined,
  });
  // Views are best-effort: a rate limit or a deleted reel isn't worth an error.
  if (error && error.code !== 'CZ429') console.error('recordReelView failed', { code: error.code });
  return ok(null);
}
