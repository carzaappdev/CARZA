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

/** The switches in Settings → Notifications. Each one mutes or unmutes a group of push types. */
export const PUSH_CATEGORIES = [
  { key: 'follows', label: 'New followers', types: ['new_follower'] },
  { key: 'likes', label: 'Likes', types: ['post_like', 'reel_like'] },
  {
    key: 'conversation',
    label: 'Replies, comments and mentions',
    types: ['post_reply', 'reel_comment', 'mention'],
  },
  {
    key: 'events',
    label: 'Events: RSVPs, reminders and cancellations',
    types: ['event_rsvp', 'event_reminder', 'event_cancelled'],
  },
] as const satisfies readonly {
  key: string;
  label: string;
  types: readonly (typeof SOCIAL_NOTIFICATION_TYPES)[number][];
}[];

export type PushCategory = (typeof PUSH_CATEGORIES)[number]['key'];

export const pushPreferencesSchema = z.object({
  muted: z.array(z.enum(PUSH_CATEGORIES.map((c) => c.key) as [PushCategory, ...PushCategory[]])),
});

/** Category keys → the notification types to store as muted. */
export function mutedPushTypes(muted: readonly PushCategory[]): NotificationType[] {
  return PUSH_CATEGORIES.filter((c) => muted.includes(c.key)).flatMap((c) => [...c.types]);
}

/** Stored muted types → the categories that are switched off. */
export function mutedPushCategories(types: readonly string[]): PushCategory[] {
  return PUSH_CATEGORIES.filter((c) => c.types.some((t) => types.includes(t))).map((c) => c.key);
}

/** A browser push subscription (PushSubscription.toJSON()), checked before it's saved. */
export const pushSubscriptionSchema = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(1000),
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{80,100}={0,2}$/),
    auth: z.string().regex(/^[A-Za-z0-9_-]{16,32}={0,2}$/),
  }),
});

/**
 * The push alert for a notification: the same words as the in-app list, with the actor's name in
 * front. `tag` makes a newer alert about the same post, reel or event replace the older one.
 */
export function describePush(
  type: NotificationType,
  data: NotificationData,
  actor: { username: string; display_name: string } | null,
): { title: string; body: string; url: string; tag: string } | null {
  const described = describeNotification(type, data, actor);
  if (!described) return null;
  const subject = data.post_id ?? data.reel_id ?? data.event_id ?? data.actor_id ?? '';
  return {
    title: 'Carza',
    body: actor ? `${actor.display_name} ${described.text}` : described.text,
    url: described.href,
    tag: `${type}:${subject}`,
  };
}
