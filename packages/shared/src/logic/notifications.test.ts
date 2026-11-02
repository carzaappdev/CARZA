import { describe, expect, it } from 'vitest';
import {
  describeNotification,
  describePush,
  mutedPushCategories,
  mutedPushTypes,
  notificationDataSchema,
  pushPreferencesSchema,
  pushSubscriptionSchema,
} from './notifications';

const id = '6f1c0b1e-8a6f-4f7a-9a51-1d6c0f2a7b10';
const actor = { username: 'jordan' };

describe('describeNotification', () => {
  it('groups likes', () => {
    expect(describeNotification('post_like', { post_id: id, count: 1 }, actor)?.text).toBe(
      'liked your post',
    );
    expect(
      describeNotification('post_like', { post_id: id, count: 3, snippet: 'WRX' }, actor),
    ).toEqual({
      text: 'and 2 others liked your post: “WRX”',
      href: `/p/${id}`,
    });
  });
  it('links replies to the conversation and reminders to the event', () => {
    expect(describeNotification('post_reply', { post_id: id, parent_id: id }, actor)?.href).toBe(
      `/p/${id}`,
    );
    expect(
      describeNotification('event_reminder', { event_id: id, snippet: 'Cars & Coffee' }, null)
        ?.text,
    ).toBe('Cars & Coffee starts soon. See you there!');
  });
  it('hides marketplace types and malformed data', () => {
    expect(describeNotification('new_message', {}, actor)).toBeNull();
    expect(
      describeNotification('post_like', notificationDataSchema.parse({ post_id: 'nope' }), actor),
    ).toBeNull();
  });
});

describe('push', () => {
  it('reads like the in-app row, with the name first', () => {
    expect(
      describePush(
        'post_like',
        { post_id: id, count: 2 },
        { username: 'jordan', display_name: 'Jordan' },
      ),
    ).toEqual({
      title: 'Carza',
      body: 'Jordan and 1 other liked your post',
      url: `/p/${id}`,
      tag: `post_like:${id}`,
    });
    expect(describePush('event_reminder', { event_id: id, snippet: 'Cruise' }, null)?.body).toBe(
      'Cruise starts soon. See you there!',
    );
    expect(describePush('new_message', {}, null)).toBeNull();
  });

  it('maps settings switches to muted types and back', () => {
    const types = mutedPushTypes(['likes', 'events']);
    expect(types).toEqual([
      'post_like',
      'reel_like',
      'event_rsvp',
      'event_reminder',
      'event_cancelled',
    ]);
    expect(mutedPushCategories(types)).toEqual(['likes', 'events']);
    expect(pushPreferencesSchema.safeParse({ muted: ['nope'] }).success).toBe(false);
  });

  it('only accepts https subscriptions with well-formed keys', () => {
    const keys = { p256dh: 'B'.repeat(87), auth: 'a'.repeat(22) };
    expect(
      pushSubscriptionSchema.safeParse({ endpoint: 'https://fcm.googleapis.com/x', keys }).success,
    ).toBe(true);
    expect(pushSubscriptionSchema.safeParse({ endpoint: 'http://evil.test/x', keys }).success).toBe(
      false,
    );
    expect(
      pushSubscriptionSchema.safeParse({
        endpoint: 'https://x.test',
        keys: { ...keys, auth: 'x' },
      }).success,
    ).toBe(false);
  });
});
