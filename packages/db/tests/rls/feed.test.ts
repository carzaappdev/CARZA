import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, anon, cleanup, createUser, type TestUser } from './helpers';

let alice: TestUser;
let bob: TestUser;
let bobName: string;

beforeAll(async () => {
  alice = await createUser('alice');
  bob = await createUser('bob');
  const { data } = await admin.from('profiles').select('username').eq('id', bob.id).single();
  bobName = data!.username;
});
afterAll(cleanup);

describe('feed tags, mentions and ranking', () => {
  it('extracts tags from the body; clients can’t set them', async () => {
    const forged = await alice.client
      .from('posts')
      .insert({ body: 'spam', tags: ['spam'] } as never);
    expect(forged.error?.code).toBe('42501');

    const { data: post } = await alice.client
      .from('posts')
      .insert({ body: 'Cars and coffee #E46 #e46 #carsAndCoffee#no x#no #1bad' })
      .select('tags')
      .single();
    expect(post!.tags).toEqual(['e46', 'carsandcoffee']);
    const { data: found } = await anon().from('posts').select('id').contains('tags', ['e46']);
    expect(found!.length).toBeGreaterThan(0);
  });

  it('notifies people you @mention, but not yourself or across a block', async () => {
    await alice.client.from('posts').insert({ body: `Great meet with @${bobName.toUpperCase()}!` });
    const { data: rows } = await bob.client
      .from('notifications')
      .select('data')
      .eq('type', 'mention');
    expect(rows).toHaveLength(1);
    expect(rows![0]?.data).toMatchObject({ actor_id: alice.id });

    await bob.client.from('blocks').insert({ blocked_id: alice.id });
    await alice.client.from('posts').insert({ body: `Hey @${bobName}` });
    const { data: after } = await bob.client
      .from('notifications')
      .select('id')
      .eq('type', 'mention');
    expect(after).toHaveLength(1);
    await bob.client.from('blocks').delete().eq('blocked_id', alice.id);
  });

  it('ranks For you without showing blocked people or reel comments', async () => {
    const { data: post } = await bob.client
      .from('posts')
      .insert({ body: 'Bob’s build #ranked' })
      .select('id')
      .single();
    const ids = async (user: TestUser) => {
      const { data, error } = await user.client.rpc('for_you_feed', { p_limit: 50 });
      if (error) throw error;
      return data.map((p) => p.id);
    };
    expect(await ids(alice)).toContain(post!.id);
    await alice.client.from('blocks').insert({ blocked_id: bob.id });
    expect(await ids(alice)).not.toContain(post!.id);
    await alice.client.from('blocks').delete().eq('blocked_id', bob.id);

    const { data: guest } = await anon().rpc('for_you_feed', { p_limit: 50 });
    expect(guest!.map((p) => p.id)).toContain(post!.id);
    expect(guest!.every((p) => p.reply_to_id === null && p.reel_id === null)).toBe(true);
  });

  it('lists trending tags', async () => {
    const { data, error } = await anon().rpc('trending_tags');
    expect(error).toBeNull();
    expect(data!.map((t) => t.tag)).toContain('e46');
  });
});
