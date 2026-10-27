// Limits enforced by the database / storage buckets. Keep in sync with supabase/migrations.
export const LIMITS = {
  listingPhotosMax: 30,
  listingPhotoMaxBytes: 10 * 1024 * 1024,
  avatarMaxBytes: 2 * 1024 * 1024,
  logoMaxBytes: 2 * 1024 * 1024,
  imageMimeTypes: ['image/jpeg', 'image/png', 'image/webp'],
  messageMaxLength: 4000,
  postMaxLength: 500,
  postPhotosMax: 4,
  feedPageSize: 20,
  listingDescriptionMaxLength: 5000,
  searchRadiusMilesMax: 500,
  searchPageSizeMax: 48,
} as const;
