import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anon, cleanup, createUser, uploadViaReservation, type TestUser } from './helpers';

let alice: TestUser;
let bob: TestUser;

beforeAll(async () => {
  alice = await createUser('alice');
  bob = await createUser('bob');
});
afterAll(cleanup);

const reelRow = (owner: string, extra: Record<string, unknown> = {}) => ({
  video_path: `${owner}/${randomUUID()}.mp4`,
  poster_path: `${owner}/${randomUUID()}.webp`,
  width: 1080,
  height: 1920,
  duration_seconds: 14.5,
  caption: 'Cold start',
  ...extra,
});

async function createReel(user: TestUser) {
  const { data, error } = await user.client
    .from('reels')
    .insert(reelRow(user.id))
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

describe('reels', () => {
  it('are public and always posted as the signed-in user', async () => {
    const r = await createReel(alice);
    expect(r.author_id).toBe(alice.id);
    expect((await anon().from('reels').select('id').eq('id', r.id)).data).toHaveLength(1);
  });

  it('reject files outside the author’s folder, long videos and forged fields', async () => {
    const tries = [
      reelRow(bob.id),
      reelRow(alice.id, { poster_path: `${bob.id}/${randomUUID()}.webp` }),
      reelRow(alice.id, { duration_seconds: 90 }),
      reelRow(alice.id, { video_path: `${alice.id}/${randomUUID()}.exe` }),
      reelRow(alice.id, { like_count: 100 }),
      reelRow(alice.id, { author_id: bob.id }),
    ];
    for (const row of tries) {
      expect(
        (await alice.client.from('reels').insert(row)).error,
        JSON.stringify(row),
      ).not.toBeNull();
    }
    expect((await anon().from('reels').insert(reelRow(alice.id))).error).not.toBeNull();
  });

  it('only the author can delete, and nobody can edit', async () => {
    const r = await createReel(alice);
    const { data: edited } = await alice.client
      .from('reels')
      .update({ caption: 'x' })
      .eq('id', r.id)
      .select();
    expect(edited ?? []).toEqual([]);
    expect((await bob.client.from('reels').delete().eq('id', r.id).select()).data).toEqual([]);
    expect((await alice.client.from('reels').delete().eq('id', r.id).select()).data).toHaveLength(
      1,
    );
  });

  it('likes count once and only as yourself', async () => {
    const r = await createReel(alice);
    expect((await bob.client.from('reel_likes').insert({ reel_id: r.id })).error).toBeNull();
    expect((await bob.client.from('reel_likes').insert({ reel_id: r.id })).error).not.toBeNull();
    expect(
      (await alice.client.from('reel_likes').insert({ reel_id: r.id, user_id: bob.id })).error,
    ).not.toBeNull();
    const count = async () =>
      (await anon().from('reels').select('like_count').eq('id', r.id).single()).data?.like_count;
    expect(await count()).toBe(1);
    await bob.client.from('reel_likes').delete().eq('reel_id', r.id).eq('user_id', bob.id);
    expect(await count()).toBe(0);
  });
});

describe('reel uploads', () => {
  it('accept videos only in the reels bucket, in your own folder', async () => {
    const video = new Blob([new Uint8Array([0, 0, 0, 0x18, 0x66, 0x74, 0x79, 0x70])], {
      type: 'video/mp4',
    });
    const mine = await uploadViaReservation(alice, 'reels', alice.id, video);
    expect(mine.error).toBeNull();
    expect(mine.path).toMatch(new RegExp(`^${alice.id}/.+\\.mp4$`));
    expect((await uploadViaReservation(alice, 'reels', bob.id, video)).error).not.toBeNull();
    expect(
      (await uploadViaReservation(alice, 'post-photos', alice.id, video)).error,
    ).not.toBeNull();
  });
});

describe('reel comments and views', () => {
  it('count comments, keep them out of the feed, and count each viewer once', async () => {
    const r = await createReel(alice);
    const { error } = await bob.client.from('posts').insert({ body: 'Clean!', reel_id: r.id });
    expect(error).toBeNull();
    const { data: reel } = await anon()
      .from('reels')
      .select('comment_count')
      .eq('id', r.id)
      .single();
    expect(reel?.comment_count).toBe(1);
    const { data: feed } = await anon()
      .from('posts')
      .select('id')
      .is('reply_to_id', null)
      .is('reel_id', null)
      .eq('author_id', bob.id);
    expect(feed).toHaveLength(0);
    // A comment can't also be a reply or an event post.
    expect(
      (await bob.client.from('posts').insert({ body: 'x', reel_id: r.id, reply_to_id: r.id }))
        .error,
    ).not.toBeNull();

    await bob.client.rpc('record_reel_view', { p_reel_id: r.id });
    await bob.client.rpc('record_reel_view', { p_reel_id: r.id });
    const guest = randomUUID();
    await anon().rpc('record_reel_view', { p_reel_id: r.id, p_guest_id: guest });
    await anon().rpc('record_reel_view', { p_reel_id: r.id, p_guest_id: guest });
    const { data: viewed } = await anon()
      .from('reels')
      .select('view_count')
      .eq('id', r.id)
      .single();
    expect(viewed?.view_count).toBe(2);
    // Counters are never client-set.
    await alice.client
      .from('reels')
      .update({ view_count: 9999 } as never)
      .eq('id', r.id);
    const { data: still } = await anon().from('reels').select('view_count').eq('id', r.id).single();
    expect(still?.view_count).toBe(2);
  });
});
