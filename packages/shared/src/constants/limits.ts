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
  // Reels are stored as uploaded (free tier, no transcoding). 50 MB is Supabase's free-plan file cap.
  reelMaxBytes: 50 * 1024 * 1024,
  reelMaxSeconds: 60,
  reelCaptionMaxLength: 300,
  reelPageSize: 8,
  videoMimeTypes: ['video/mp4', 'video/quicktime', 'video/webm'],
  listingDescriptionMaxLength: 5000,
  searchRadiusMilesMax: 500,
  searchPageSizeMax: 48,
} as const;
