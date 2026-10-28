import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anon, cleanup, createUser, type TestUser } from './helpers';

let alice: TestUser;
let bob: TestUser;
let carol: TestUser;

beforeAll(async () => {
  alice = await createUser('alice');
  bob = await createUser('bob');
  carol = await createUser('carol');
});
afterAll(cleanup);

async function mine(user: TestUser, type?: string) {
  let q = user.client.from('notifications').select('type, data, read_at').order('created_at');
  if (type) q = q.eq('type', type as never);
  const { data, error } = await q;
  if (error) throw error;
  return data as { type: string; data: Record<string, unknown>; read_at: string | null }[];
}

describe('social notifications', () => {
  it('tell you about follows, once per follower', async () => {
    await bob.client.from('follows').insert({ followee_id: alice.id });
    await bob.client.from('follows').delete().eq('followee_id', alice.id);
    await bob.client.from('follows').insert({ followee_id: alice.id });
    const rows = await mine(alice, 'new_follower');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.data.actor_id).toBe(bob.id);
  });

  it('group likes on a post into one unread row, and skip your own likes', async () => {
    const { data: post } = await alice.client
      .from('posts')
      .insert({ body: 'New wheels' })
      .select('id')
      .single();
    await alice.client.from('post_likes').insert({ post_id: post!.id });
    await bob.client.from('post_likes').insert({ post_id: post!.id });
    await carol.client.from('post_likes').insert({ post_id: post!.id });
    const rows = await mine(alice, 'post_like');
    expect(rows).toHaveLength(1);
    expect(rows[0]?.data).toMatchObject({ post_id: post!.id, actor_id: carol.id, count: 2 });
    expect(rows[0]?.data.snippet).toBe('New wheels');
  });

  it('tell you about replies and RSVPs, but not your own', async () => {
    const { data: post } = await alice.client
      .from('posts')
      .insert({ body: 'Who is going?' })
      .select('id')
      .single();
    await alice.client.from('posts').insert({ body: 'me', reply_to_id: post!.id });
    await bob.client.from('posts').insert({ body: 'I am', reply_to_id: post!.id });
    expect(await mine(alice, 'post_reply')).toHaveLength(1);

    const { data: event } = await alice.client
      .from('events')
      .insert({
        title: 'Night cruise',
        starts_at: new Date(Date.now() + 3 * 86_400_000).toISOString(),
        timezone: 'America/Chicago',
        venue_name: 'Lot',
        postal_code: '78701',
      })
      .select('id')
      .single();
    await bob.client.from('event_rsvps').insert({ event_id: event!.id });
    const rsvps = await mine(alice, 'event_rsvp');
    expect(rsvps).toHaveLength(1);
    expect(rsvps[0]?.data.actor_id).toBe(bob.id);

    // Cancelling tells guests, not the host.
    await alice.client
      .from('events')
      .update({ cancelled_at: new Date().toISOString() })
      .eq('id', event!.id);
    expect(await mine(bob, 'event_cancelled')).toHaveLength(1);
    expect(await mine(alice, 'event_cancelled')).toHaveLength(0);
  });

  it('are private and can only be marked read or deleted by their owner', async () => {
    expect((await anon().from('notifications').select('id')).data ?? []).toHaveLength(0);
    expect(
      (await bob.client.from('notifications').select('user_id').eq('user_id', alice.id)).data,
    ).toHaveLength(0);
    expect(
      (
        await bob.client
          .from('notifications')
          .insert({ user_id: alice.id, type: 'new_follower' } as never)
      ).error,
    ).not.toBeNull();
    const { error } = await alice.client
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .is('read_at', null);
    expect(error).toBeNull();
    expect((await mine(alice)).every((r) => r.read_at !== null)).toBe(true);
  });
});
