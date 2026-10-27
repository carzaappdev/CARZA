import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, anon, cleanup, createUser, uploadViaReservation, type TestUser } from './helpers';

let alice: TestUser;
let bob: TestUser;

beforeAll(async () => {
  alice = await createUser('alice');
  bob = await createUser('bob');
});
afterAll(cleanup);

async function post(user: TestUser, body = 'Cars and coffee this Saturday?', replyToId?: string) {
  const { data, error } = await user.client
    .from('posts')
    .insert({ body, reply_to_id: replyToId ?? null })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

const photo = (owner: string) => ({
  path: `${owner}/${randomUUID()}.webp`,
  width: 1200,
  height: 900,
});

describe('posts', () => {
  it('are public, and the author is always the signed-in user', async () => {
    const p = await post(alice);
    expect(p.author_id).toBe(alice.id);
    const { data } = await anon().from('posts').select('id').eq('id', p.id);
    expect(data).toHaveLength(1);
  });

  it("can't be created signed out, as someone else, or with forged counters", async () => {
    const { error: anonErr } = await anon().from('posts').insert({ body: 'hi' });
    expect(anonErr).not.toBeNull();
    const { error: asBob } = await alice.client
      .from('posts')
      .insert({ body: 'hi', author_id: bob.id });
    expect(asBob).not.toBeNull();
    const { error: counts } = await alice.client
      .from('posts')
      .insert({ body: 'hi', like_count: 999 });
    expect(counts).not.toBeNull();
  });

  it('reject empty bodies and photos outside the author’s folder', async () => {
    const { error: empty } = await alice.client.from('posts').insert({ body: '  ' });
    expect(empty).not.toBeNull();
    const { error: stolen } = await alice.client
      .from('posts')
      .insert({ body: '', photos: [photo(bob.id)] });
    expect(stolen).not.toBeNull();
    const { error: ok } = await alice.client
      .from('posts')
      .insert({ body: '', photos: [photo(alice.id)] });
    expect(ok).toBeNull();
  });

  it("can't be edited, and only the author can delete", async () => {
    const p = await post(alice);
    const { data: edited } = await alice.client
      .from('posts')
      .update({ body: 'x' })
      .eq('id', p.id)
      .select();
    expect(edited ?? []).toEqual([]);
    const { data: bobDel } = await bob.client.from('posts').delete().eq('id', p.id).select();
    expect(bobDel).toEqual([]);
    const { data: del } = await alice.client.from('posts').delete().eq('id', p.id).select();
    expect(del).toHaveLength(1);
  });

  it('keep reply counts in sync', async () => {
    const p = await post(alice);
    const r = await post(bob, 'Count me in', p.id);
    const read = async () =>
      (await admin.from('posts').select('reply_count').eq('id', p.id).single()).data?.reply_count;
    expect(await read()).toBe(1);
    await bob.client.from('posts').delete().eq('id', r.id);
    expect(await read()).toBe(0);
  });

  it('accept photos uploaded through a reservation in the user’s own folder only', async () => {
    const file = new Blob([new Uint8Array([0x52, 0x49, 0x46, 0x46])], { type: 'image/webp' });
    const mine = await uploadViaReservation(alice, 'post-photos', alice.id, file);
    expect(mine.error).toBeNull();
    expect(mine.path?.startsWith(`${alice.id}/`)).toBe(true);
    const theirs = await uploadViaReservation(alice, 'post-photos', bob.id, file);
    expect(theirs.error).not.toBeNull();
  });
});

describe('likes', () => {
  it('count once per user and can be undone', async () => {
    const p = await post(alice);
    expect((await bob.client.from('post_likes').insert({ post_id: p.id })).error).toBeNull();
    expect((await bob.client.from('post_likes').insert({ post_id: p.id })).error).not.toBeNull();
    const read = async () =>
      (await anon().from('posts').select('like_count').eq('id', p.id).single()).data?.like_count;
    expect(await read()).toBe(1);
    await bob.client.from('post_likes').delete().eq('post_id', p.id).eq('user_id', bob.id);
    expect(await read()).toBe(0);
  });

  it("can't be added for someone else or removed by someone else", async () => {
    const p = await post(alice);
    const { error } = await alice.client
      .from('post_likes')
      .insert({ post_id: p.id, user_id: bob.id });
    expect(error).not.toBeNull();
    await bob.client.from('post_likes').insert({ post_id: p.id });
    const { data } = await alice.client.from('post_likes').delete().eq('post_id', p.id).select();
    expect(data).toEqual([]);
  });
});

describe('follows', () => {
  it('power the following feed', async () => {
    const carol = await createUser('carol');
    const p = await post(bob, 'Fresh wrap');
    let feed = (await carol.client.rpc('following_feed', {})).data ?? [];
    expect(feed.map((x) => x.id)).not.toContain(p.id);

    expect((await carol.client.from('follows').insert({ followee_id: bob.id })).error).toBeNull();
    feed = (await carol.client.rpc('following_feed', {})).data ?? [];
    expect(feed.map((x) => x.id)).toContain(p.id);
  });

  it("can't follow yourself, follow as someone else, or remove someone else's follow", async () => {
    expect(
      (await alice.client.from('follows').insert({ followee_id: alice.id })).error,
    ).not.toBeNull();
    const { error } = await alice.client
      .from('follows')
      .insert({ follower_id: bob.id, followee_id: alice.id });
    expect(error).not.toBeNull();
    await bob.client.from('follows').insert({ followee_id: alice.id });
    const { data } = await alice.client.from('follows').delete().eq('follower_id', bob.id).select();
    expect(data).toEqual([]);
  });

  it('the following feed is not available signed out', async () => {
    const { error } = await anon().rpc('following_feed', {});
    expect(error).not.toBeNull();
  });
});

describe('rate limits', () => {
  it('cap posting', async () => {
    const spammer = await createUser('spammer');
    let code: string | undefined;
    for (let i = 0; i < 31 && !code; i++) {
      code = (await spammer.client.from('posts').insert({ body: `post ${i}` })).error?.code;
    }
    expect(code).toBe('CZ429');
  });
});
