import { z } from 'zod';
import { LIMITS } from '../constants/limits';

const ownFile = (ext: string) =>
  z.string().regex(new RegExp(`^[0-9a-f-]{36}/[0-9a-f-]{36}\\.(${ext})$`));

export const createReelSchema = z.object({
  videoPath: ownFile('mp4|mov|webm'),
  posterPath: ownFile('jpg|png|webp'),
  width: z.int().min(1).max(8192),
  height: z.int().min(1).max(8192),
  durationSeconds: z
    .number()
    .positive()
    .max(LIMITS.reelMaxSeconds + 1, `Reels can be up to ${LIMITS.reelMaxSeconds} seconds.`),
  caption: z
    .string()
    .trim()
    .max(LIMITS.reelCaptionMaxLength, 'Captions can be up to 300 characters.'),
});
export type CreateReelInput = z.infer<typeof createReelSchema>;

export const reelIdSchema = z.object({ reelId: z.guid() });
export const setReelLikedSchema = z.object({ reelId: z.guid(), liked: z.boolean() });

/** Keyset cursor for the reels feed: the last reel seen. */
export const reelCursorSchema = z.object({
  before: z.iso.datetime({ offset: true }).nullable(),
  beforeId: z.guid().nullable(),
});
export type ReelCursor = z.infer<typeof reelCursorSchema>;

/** Why a picked video can't be a reel, or null if it can. Checked in the browser before uploading. */
export function reelFileProblem(file: { type: string; size: number }, durationSeconds: number) {
  if (!(LIMITS.videoMimeTypes as readonly string[]).includes(file.type)) {
    return 'Use an MP4, MOV or WebM video.';
  }
  if (file.size > LIMITS.reelMaxBytes)
    return 'That video is over 50 MB. Trim it or record a shorter clip.';
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0)
    return 'That video couldn’t be read.';
  if (durationSeconds > LIMITS.reelMaxSeconds + 0.5) {
    return `Reels can be up to ${LIMITS.reelMaxSeconds} seconds. Trim it and try again.`;
  }
  return null;
}

/** Counting a reel view: guests pass the random id their browser keeps. */
export const recordReelViewSchema = z.object({ reelId: z.guid(), guestId: z.guid().nullable() });
