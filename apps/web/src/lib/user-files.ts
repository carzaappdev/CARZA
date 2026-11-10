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

/**
 * Moves everything in an account's public folders into the private evidence bucket, so nothing it
 * uploaded can be opened by link while it's kept for a legal hold. Returns how many files moved.
 */
export async function preserveUserFiles(userId: string, holdId: string) {
  const admin = createAdminClient();
  if (!admin) {
    console.error('preserveUserFiles: no secret key, files left public', { userId });
    return { moved: 0, ok: false };
  }
  let moved = 0;
  let ok = true;
  for (const bucket of USER_BUCKETS) {
    const store = admin.storage.from(bucket);
    for (let page = 0; page < 50; page++) {
      const { data: files, error: listError } = await store.list(userId, { limit: 100 });
      if (listError) ok = false;
      if (listError || !files.length) break;
      let movedThisPage = 0;
      for (const f of files) {
        const { error } = await store.move(
          `${userId}/${f.name}`,
          `${holdId}/${bucket}/${userId}/${f.name}`,
          { destinationBucket: 'evidence' },
        );
        if (error) ok = false;
        else movedThisPage += 1;
      }
      moved += movedThisPage;
      // Nothing moved on this page: stop rather than list the same files again.
      if (movedThisPage === 0) break;
    }
  }
  if (!ok) console.error('preserveUserFiles: some files could not be moved', { userId, holdId });
  return { moved, ok };
}

/** Deletes specific public files (a removed post's photos, a removed reel's video and poster). */
export async function removeFiles(files: { bucket: string; path: string }[]) {
  const admin = createAdminClient();
  if (!admin) return files.length === 0;
  let ok = true;
  for (const bucket of new Set(files.map((f) => f.bucket))) {
    const paths = files.filter((f) => f.bucket === bucket).map((f) => f.path);
    const { error } = await admin.storage.from(bucket).remove(paths);
    if (error) ok = false;
  }
  return ok;
}
