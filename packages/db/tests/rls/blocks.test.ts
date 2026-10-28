import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, anon, cleanup, createUser, type TestUser } from './helpers';

let alice: TestUser;
let bob: TestUser;
let carol: TestUser;

beforeAll(async () => {
  alice = await createUser('alice');
  bob = await createUser('bob');
  carol = await createUser('carol');
});
afterAll(cleanup);

async function post(user: TestUser, body = 'Meet tonight?') {
  const { data, error } = await user.client.from('posts').insert({ body }).select('id').single();
  if (error) throw error;
  return data.id;
}

async function reel(user: TestUser) {
  const { data, error } = await user.client
    .from('reels')
    .insert({
      video_path: `${user.id}/${randomUUID()}.mp4`,
      poster_path: `${user.id}/${randomUUID()}.webp`,
      width: 1080,
      height: 1920,
      duration_seconds: 10,
      caption: 'Launch',
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function event(user: TestUser) {
  const { data, error } = await user.client
    .from('events')
    .insert({
      title: 'Cars & Coffee',
      starts_at: new Date(Date.now() + 2 * 86_400_000).toISOString(),
      timezone: 'America/Chicago',
      venue_name: 'Coffee shop',
      postal_code: '78701',
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

describe('blocks', () => {
  it('hide content both ways, cut follows and RSVPs, and block new interactions', async () => {
    const alicePost = await post(alice);
    const bobPost = await post(bob);
    const aliceReel = await reel(alice);
    const aliceEvent = await event(alice);
    expect((await bob.client.from('follows').insert({ followee_id: alice.id })).error).toBeNull();
    expect((await alice.client.from('follows').insert({ followee_id: bob.id })).error).toBeNull();
    expect(
      (await bob.client.from('event_rsvps').insert({ event_id: aliceEvent })).error,
    ).toBeNull();

    expect((await alice.client.from('blocks').insert({ blocked_id: bob.id })).error).toBeNull();

    // Neither side sees the other's content; everyone else still does.
    const seen = async (u: TestUser, table: 'posts' | 'reels' | 'events', id: string) =>
      (await u.client.from(table).select('id').eq('id', id)).data?.length ?? 0;
    expect(await seen(bob, 'posts', alicePost)).toBe(0);
    expect(await seen(alice, 'posts', bobPost)).toBe(0);
    expect(await seen(bob, 'reels', aliceReel)).toBe(0);
    expect(await seen(bob, 'events', aliceEvent)).toBe(0);
    expect(await seen(carol, 'posts', alicePost)).toBe(1);
    expect((await anon().from('posts').select('id').eq('id', alicePost)).data).toHaveLength(1);

    // Follows (both ways) and Bob's RSVP are gone.
    const { count: follows } = await admin
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .or(
        `and(follower_id.eq.${alice.id},followee_id.eq.${bob.id}),and(follower_id.eq.${bob.id},followee_id.eq.${alice.id})`,
      );
    expect(follows).toBe(0);
    const { count: rsvps } = await admin
      .from('event_rsvps')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', aliceEvent)
      .eq('user_id', bob.id);
    expect(rsvps).toBe(0);

    // Bob can't reply, like, follow or RSVP across the block, even with known ids.
    expect(
      (await bob.client.from('posts').insert({ body: 'hey', reply_to_id: alicePost })).error,
    ).not.toBeNull();
    expect(
      (await bob.client.from('post_likes').insert({ post_id: alicePost })).error,
    ).not.toBeNull();
    expect(
      (await bob.client.from('reel_likes').insert({ reel_id: aliceReel })).error,
    ).not.toBeNull();
    expect(
      (await bob.client.from('follows').insert({ followee_id: alice.id })).error,
    ).not.toBeNull();
    expect(
      (await bob.client.from('event_rsvps').insert({ event_id: aliceEvent })).error,
    ).not.toBeNull();
  });

  it('are private to the blocker and only removable by them', async () => {
    expect((await carol.client.from('blocks').insert({ blocked_id: bob.id })).error).toBeNull();
    // Bob can't see that Carol blocked him, and can't remove it.
    expect((await bob.client.from('blocks').select('*')).data).toHaveLength(0);
    await bob.client.from('blocks').delete().eq('blocker_id', carol.id);
    expect((await carol.client.from('blocks').select('blocked_id')).data).toEqual([
      { blocked_id: bob.id },
    ]);
    // Nobody can block on someone else's behalf, or block themselves.
    expect(
      (await bob.client.from('blocks').insert({ blocker_id: carol.id, blocked_id: alice.id }))
        .error,
    ).not.toBeNull();
    expect((await bob.client.from('blocks').insert({ blocked_id: bob.id })).error).not.toBeNull();
    expect((await anon().from('blocks').insert({ blocked_id: bob.id })).error).not.toBeNull();

    // Unblocking restores visibility.
    const bobPost = await post(bob);
    expect((await carol.client.from('posts').select('id').eq('id', bobPost)).data).toHaveLength(0);
    expect((await carol.client.from('blocks').delete().eq('blocked_id', bob.id)).error).toBeNull();
    expect((await carol.client.from('posts').select('id').eq('id', bobPost)).data).toHaveLength(1);
  });
});

describe('reports on social content', () => {
  it('snapshot posts, reels and events, but not your own', async () => {
    const p = await post(carol, 'spam spam');
    const r = await reel(carol);
    const e = await event(carol);
    for (const [target_type, target_id] of [
      ['post', p],
      ['reel', r],
      ['event', e],
    ] as const) {
      const { data, error } = await alice.client
        .from('reports')
        .insert({ target_type, target_id, reason: 'spam' })
        .select('target_snapshot, status')
        .single();
      expect(error).toBeNull();
      expect(data?.status).toBe('open');
      expect(Object.keys(data?.target_snapshot ?? {}).length).toBeGreaterThan(0);
    }
    expect(
      (
        await carol.client
          .from('reports')
          .insert({ target_type: 'post', target_id: p, reason: 'spam' })
      ).error,
    ).not.toBeNull();
    // Reporters only see their own reports.
    expect((await carol.client.from('reports').select('id')).data).toHaveLength(0);
  });
});
