'use server';

import { z } from 'zod';
import { fail, LIMITS, ok, type ActionResult } from '@carza/shared';
import { getUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

const schema = z
  .object({
    bucket: z.enum(['post-photos', 'avatars', 'reels']),
    contentType: z.enum([...LIMITS.imageMimeTypes, ...LIMITS.videoMimeTypes]),
  })
  // Videos only go to reels (the database enforces this too).
  .refine((v) => v.bucket === 'reels' || !v.contentType.startsWith('video/'));

/**
 * Reserves an upload slot in the user's own folder (permission + rate limit checked by the database, as
 * the user), then signs an upload URL for exactly that path. The browser uploads with the token.
 */
export async function reserveUpload(
  input: unknown,
): Promise<ActionResult<{ path: string; token: string }>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION', 'That file type isn’t supported.');
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in to upload.');

  const admin = createAdminClient();
  if (!admin) {
    console.error('reserveUpload: SUPABASE_SECRET_KEY is not configured');
    return fail('INTERNAL', 'Uploads aren’t switched on yet.');
  }

  const supabase = await createClient();
  const { data: path, error } = await supabase.rpc('reserve_upload', {
    p_bucket: parsed.data.bucket,
    p_target_id: user.id,
    p_content_type: parsed.data.contentType,
  });
  if (error || !path) {
    if (error?.code === 'CZ429')
      return fail('RATE_LIMITED', 'You’ve uploaded a lot recently. Try again later.');
    console.error('reserve_upload failed', { code: error?.code, userId: user.id });
    return fail('INTERNAL', 'Couldn’t start the upload. Try again.');
  }

  const signed = await admin.storage.from(parsed.data.bucket).createSignedUploadUrl(path);
  if (signed.error) {
    console.error('createSignedUploadUrl failed', { userId: user.id });
    return fail('INTERNAL', 'Couldn’t start the upload. Try again.');
  }
  return ok({ path, token: signed.data.token });
}
