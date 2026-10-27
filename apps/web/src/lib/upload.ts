import { reserveUpload } from '@/lib/actions/uploads';
import { createClient } from '@/lib/supabase/browser';

/**
 * Uploads a file to the user's own folder in `bucket` (reserve → signed URL → direct upload).
 * Returns the stored path, or a message to show.
 */
export async function uploadFile(
  bucket: 'post-photos' | 'avatars' | 'reels',
  blob: Blob,
  contentType: string = 'image/webp',
): Promise<{ path: string } | { error: string }> {
  const slot = await reserveUpload({ bucket, contentType });
  if (!slot.ok) return { error: slot.error.message };
  const { error } = await createClient()
    .storage.from(bucket)
    .uploadToSignedUrl(slot.data.path, slot.data.token, blob, { contentType });
  if (error) return { error: 'The upload didn’t finish. Check your connection and try again.' };
  return { path: slot.data.path };
}

/** A prepared WebP photo. */
export const uploadImage = (bucket: 'post-photos' | 'avatars' | 'reels', blob: Blob) =>
  uploadFile(bucket, blob, 'image/webp');
