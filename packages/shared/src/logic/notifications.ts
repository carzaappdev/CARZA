import { z } from 'zod';
import type { NOTIFICATION_TYPES } from '../constants/enums';

type NotificationType = (typeof NOTIFICATION_TYPES)[number];

/** The notifications the social app shows. Marketplace ones stay hidden while it's parked. */
export const SOCIAL_NOTIFICATION_TYPES = [
  'new_follower',
  'post_like',
  'post_reply',
  'mention',
  'reel_like',
  'reel_comment',
  'event_rsvp',
  'event_reminder',
  'event_cancelled',
] as const satisfies readonly NotificationType[];

/** The `data` the database writes on social notifications. Anything unexpected is dropped. */
export const notificationDataSchema = z
  .object({
    actor_id: z.guid().optional(),
    post_id: z.guid().optional(),
    parent_id: z.guid().optional(),
    reel_id: z.guid().optional(),
    event_id: z.guid().optional(),
    count: z.int().min(1).optional(),
    snippet: z.string().max(200).optional(),
  })
  .catch({});
export type NotificationData = z.infer<typeof notificationDataSchema>;

/**
 * What a notification says (after the actor's name, when there is one) and where it opens.
 * Null for types the social app doesn't show (marketplace ones).
 */
export function describeNotification(
  type: NotificationType,
  data: NotificationData,
  actor: { username: string } | null,
): { text: string; href: string } | null {
  const others = (data.count ?? 1) - 1;
  const andOthers = others > 0 ? ` and ${others} ${others === 1 ? 'other' : 'others'}` : '';
  const quote = data.snippet ? `: “${data.snippet}”` : '';
  switch (type) {
    case 'new_follower':
      return actor ? { text: 'started following you', href: `/u/${actor.username}` } : null;
    case 'post_like':
      return data.post_id
        ? { text: `${andOthers} liked your post${quote}`.trimStart(), href: `/p/${data.post_id}` }
        : null;
    case 'reel_like':
      return data.reel_id
        ? {
            text: `${andOthers} liked your reel${quote}`.trimStart(),
            href: `/reels/${data.reel_id}`,
          }
        : null;
    case 'post_reply':
      return data.parent_id ? { text: `replied${quote}`, href: `/p/${data.parent_id}` } : null;
    case 'mention':
      return data.post_id ? { text: `mentioned you${quote}`, href: `/p/${data.post_id}` } : null;
    case 'reel_comment':
      return data.reel_id
        ? { text: `commented on your reel${quote}`, href: `/reels/${data.reel_id}` }
        : null;
    case 'event_rsvp':
      return data.event_id
        ? { text: `is going to ${data.snippet ?? 'your event'}`, href: `/events/${data.event_id}` }
        : null;
    case 'event_reminder':
      return data.event_id
        ? {
            text: `${data.snippet ?? 'Your event'} starts soon. See you there!`,
            href: `/events/${data.event_id}`,
          }
        : null;
    case 'event_cancelled':
      return data.event_id
        ? {
            text: `cancelled ${data.snippet ?? 'an event you were going to'}`,
            href: `/events/${data.event_id}`,
          }
        : null;
    default:
      return null;
  }
}
