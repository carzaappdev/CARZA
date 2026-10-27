'use server';

import { revalidatePath } from 'next/cache';
import { getFeed, type FeedPage } from '@carza/db';
import {
  createPostSchema,
  fail,
  feedCursorSchema,
  ok,
  postIdSchema,
  setPostLikedSchema,
  type ActionResult,
} from '@carza/shared';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/** Publishes a post or a reply. Photos must already be uploaded to the author's folder. */
export async function createPost(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = createPostSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION', parsed.error.issues[0]?.message ?? 'That post isn’t valid.');
  }
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in to post.');

  const { body, photos, replyToId } = parsed.data;
  const supabase = await createClient();

  // Every photo must exist in the author's own folder (the database also checks the folder).
  const bucket = supabase.storage.from('post-photos');
  for (const photo of photos) {
    if (!photo.path.startsWith(`${user.id}/`)) return fail('FORBIDDEN', 'That photo isn’t yours.');
    const { data: exists } = await bucket.exists(photo.path);
    if (!exists) return fail('VALIDATION', 'A photo didn’t finish uploading. Try adding it again.');
  }

  const { data, error } = await supabase
    .from('posts')
    .insert({ body, photos, reply_to_id: replyToId })
    .select('id')
    .single();
  if (error) {
    if (error.code === 'CZ429')
      return fail('RATE_LIMITED', 'You’re posting a lot. Take a breather and try again soon.');
    if (error.code === '23503') return fail('NOT_FOUND', 'That post was deleted.');
    console.error('createPost failed', { code: error.code, userId: user.id });
    return fail('INTERNAL', 'Couldn’t post. Try again.');
  }
  revalidatePath('/');
  if (replyToId) revalidatePath(`/p/${replyToId}`);
  return ok({ id: data.id });
}

/** Deletes the viewer's own post (RLS) and its photos. */
export async function deletePost(input: unknown): Promise<ActionResult<null>> {
  const parsed = postIdSchema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION', 'That request wasn’t valid.');
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in first.');

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('posts')
    .delete()
    .eq('id', parsed.data.postId)
    .select('photos, reply_to_id');
  if (error) {
    console.error('deletePost failed', { code: error.code, userId: user.id });
    return fail('INTERNAL', 'Couldn’t delete the post. Try again.');
  }
  const deleted = data[0];
  if (!deleted) return fail('NOT_FOUND', 'That post is already gone.');

  const paths = (Array.isArray(deleted.photos) ? deleted.photos : []).flatMap((p) =>
    p && typeof p === 'object' && 'path' in p && typeof p.path === 'string' ? [p.path] : [],
  );
  if (paths.length) await supabase.storage.from('post-photos').remove(paths);
  revalidatePath('/');
  if (deleted.reply_to_id) revalidatePath(`/p/${deleted.reply_to_id}`);
  return ok(null);
}

export async function setPostLiked(input: unknown): Promise<ActionResult<{ liked: boolean }>> {
  const parsed = setPostLikedSchema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION', 'That request wasn’t valid.');
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in to like posts.');

  const { postId, liked } = parsed.data;
  const supabase = await createClient();
  const { error } = liked
    ? await supabase
        .from('post_likes')
        .upsert({ post_id: postId }, { onConflict: 'post_id,user_id', ignoreDuplicates: true })
    : await supabase.from('post_likes').delete().eq('post_id', postId).eq('user_id', user.id);
  if (error) {
    if (error.code === 'CZ429') return fail('RATE_LIMITED', 'Slow down a little and try again.');
    if (error.code === '23503') return fail('NOT_FOUND', 'That post was deleted.');
    console.error('setPostLiked failed', { code: error.code, userId: user.id });
    return fail('INTERNAL', 'Couldn’t update your like. Try again.');
  }
  return ok({ liked });
}

/** The next page of a feed, for infinite scroll. */
export async function loadFeedPage(input: unknown): Promise<ActionResult<FeedPage>> {
  const parsed = feedCursorSchema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION', 'That request wasn’t valid.');
  const user = await getUser();
  try {
    return ok(await getFeed(await createClient(), parsed.data, user?.id ?? null));
  } catch (e) {
    console.error('loadFeedPage failed', { error: (e as { code?: string }).code });
    return fail('INTERNAL', 'Couldn’t load more posts.');
  }
}
