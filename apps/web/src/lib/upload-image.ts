import { reserveImageUpload } from '@/lib/actions/uploads';
import { createClient } from '@/lib/supabase/browser';

/** Uploads a prepared WebP to the user's folder in `bucket`. Returns the stored path or an error message. */
export async function uploadImage(
  bucket: 'post-photos' | 'avatars',
  blob: Blob,
): Promise<{ path: string } | { error: string }> {
  const slot = await reserveImageUpload({ bucket, contentType: 'image/webp' });
  if (!slot.ok) return { error: slot.error.message };
  const { error } = await createClient()
    .storage.from(bucket)
    .uploadToSignedUrl(slot.data.path, slot.data.token, blob, { contentType: 'image/webp' });
  if (error) return { error: 'The photo didn’t upload. Check your connection and try again.' };
  return { path: slot.data.path };
}
