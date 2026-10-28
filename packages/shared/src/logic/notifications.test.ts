import { describe, expect, it } from 'vitest';
import { describeNotification, notificationDataSchema } from './notifications';

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
