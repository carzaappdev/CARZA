import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, anon, cleanup, createUser, type TestUser } from './helpers';

let alice: TestUser;
let bob: TestUser;

beforeAll(async () => {
  alice = await createUser('alice');
  bob = await createUser('bob');
});
afterAll(cleanup);

describe('delete_my_account', () => {
  it("can't be called signed out", async () => {
    const { error } = await anon().rpc('delete_my_account');
    expect(error).not.toBeNull();
  });

  it('deletes only the caller, and everything they own, cleanly', async () => {
    const { data: bobPost, error: postError } = await bob.client
      .from('posts')
      .insert({ body: 'Bob’s build' })
      .select('id')
      .single();
    expect(postError).toBeNull();
    const { error: aliceError } = await alice.client.from('posts').insert({ body: 'Alice’s car' });
    expect(aliceError).toBeNull();
    expect(
      (await alice.client.from('post_likes').insert({ post_id: bobPost!.id })).error,
    ).toBeNull();
    expect((await alice.client.from('follows').insert({ followee_id: bob.id })).error).toBeNull();
    expect((await bob.client.from('follows').insert({ followee_id: alice.id })).error).toBeNull();
    expect((await alice.client.from('blocks').insert({ blocked_id: bob.id })).error).toBeNull();

    const { error } = await alice.client.rpc('delete_my_account');
    expect(error).toBeNull();

    const { data: authUser } = await admin.auth.admin.getUserById(alice.id);
    expect(authUser.user).toBeNull();
    const { data: profiles } = await admin.from('profiles').select('id').eq('id', alice.id);
    expect(profiles).toEqual([]);
    const { data: posts } = await admin.from('posts').select('id').eq('author_id', alice.id);
    expect(posts).toEqual([]);
    const { data: follows } = await admin
      .from('follows')
      .select('follower_id')
      .or(`follower_id.eq.${alice.id},followee_id.eq.${alice.id}`);
    expect(follows).toEqual([]);

    // Bob is untouched, and the like Alice left is gone from his count.
    const { data: bobProfile } = await admin.from('profiles').select('id').eq('id', bob.id);
    expect(bobProfile).toHaveLength(1);
    const { data: post } = await admin
      .from('posts')
      .select('like_count')
      .eq('id', bobPost!.id)
      .single();
    expect(post?.like_count).toBe(0);
  });
});
