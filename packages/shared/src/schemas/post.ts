import { z } from 'zod';
import { LIMITS } from '../constants/limits';

/** One photo on a post. The path must sit in the author's own folder (the database checks it too). */
export const postPhotoSchema = z.object({
  path: z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/),
  width: z.int().min(1).max(99999),
  height: z.int().min(1).max(99999),
});
export type PostPhoto = z.infer<typeof postPhotoSchema>;

export const createPostSchema = z
  .object({
    body: z.string().trim().max(LIMITS.postMaxLength, 'Posts can be up to 500 characters.'),
    photos: z.array(postPhotoSchema).max(LIMITS.postPhotosMax, 'Up to 4 photos per post.'),
    replyToId: z.guid().nullable(),
    eventId: z.guid().nullable().default(null),
    reelId: z.guid().nullable().default(null),
  })
  .refine((p) => p.body.length > 0 || p.photos.length > 0, {
    message: 'Write something or add a photo.',
    path: ['body'],
  })
  .refine((p) => [p.replyToId, p.eventId, p.reelId].filter(Boolean).length <= 1, {
    message: 'A post can reply to one thing at a time.',
  });
export type CreatePostInput = z.infer<typeof createPostSchema>;

export const postIdSchema = z.object({ postId: z.guid() });

export const setPostLikedSchema = z.object({ postId: z.guid(), liked: z.boolean() });

export const setFollowingSchema = z.object({ userId: z.guid(), following: z.boolean() });

/** Keyset cursor for the feeds: the last post seen. */
export const feedCursorSchema = z.object({
  feed: z.enum(['for-you', 'following']),
  before: z.iso.datetime({ offset: true }).nullable(),
  beforeId: z.guid().nullable(),
});
export type FeedCursor = z.infer<typeof feedCursorSchema>;

/** Ask for an upload slot for one post photo. */
export const reservePostPhotoSchema = z.object({
  contentType: z.enum(LIMITS.imageMimeTypes),
});

/** Edit profile. Username rules match the database check. */
export const updateProfileSchema = z.object({
  displayName: z
    .string()
    .trim()
    .min(1, 'Add your name.')
    .max(60, 'Names can be up to 60 characters.'),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9_]{3,30}$/, '3–30 characters: letters, numbers and underscores.'),
  bio: z.string().trim().max(500, 'Bios can be up to 500 characters.'),
  avatarPath: z
    .string()
    .regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/)
    .nullable(),
});
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
