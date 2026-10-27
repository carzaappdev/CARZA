import { clientEnv } from '@/env/client';

export type PublicBucket = 'listing-photos' | 'avatars' | 'post-photos' | 'reels';

/** Public URL for an object in one of the public buckets. */
export const publicStorageUrl = (bucket: PublicBucket, path: string) =>
  `${clientEnv.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
