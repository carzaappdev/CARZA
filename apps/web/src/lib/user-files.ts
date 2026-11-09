import 'server-only';
import { createAdminClient } from '@/lib/supabase/admin';

const USER_BUCKETS = ['avatars', 'post-photos', 'reels'] as const;

/**
 * Removes everything in a deleted account's `{user_id}/` folders. The user no longer exists to prove
 * ownership, so this needs the secret key. Call it only after the account itself is gone.
 */
export async function removeUserFiles(userId: string) {
  const admin = createAdminClient();
  if (!admin) {
    console.error('removeUserFiles: no secret key, files left behind', { userId });
    return;
  }
  for (const bucket of USER_BUCKETS) {
    const store = admin.storage.from(bucket);
    // Bounded: at most 5,000 files per bucket, so a stuck listing can't spin forever.
    for (let page = 0; page < 50; page++) {
      const { data: files, error: listError } = await store.list(userId, { limit: 100 });
      if (listError || !files.length) break;
      const { error: removeError } = await store.remove(files.map((f) => `${userId}/${f.name}`));
      if (removeError) {
        console.error('removeUserFiles: cleanup failed', { bucket, userId });
        break;
      }
    }
  }
}
