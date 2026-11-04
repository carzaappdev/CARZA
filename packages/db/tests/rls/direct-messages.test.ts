import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { cleanup, createUser, type TestUser } from './helpers';

let alice: TestUser;
let bob: TestUser;
let stranger: TestUser;

beforeAll(async () => {
  [alice, bob, stranger] = await Promise.all([
    createUser('dm-alice'),
    createUser('dm-bob'),
    createUser('dm-stranger'),
  ]);
});
afterAll(cleanup);

async function open(from: TestUser, to: TestUser) {
  const { data, error } = await from.client.rpc('start_direct_conversation', { p_user_id: to.id });
  expect(error).toBeNull();
  return data!;
}

describe('direct messages', () => {
  it('one thread per pair, whoever opens it', async () => {
    const a = await open(alice, bob);
    const b = await open(bob, alice);
    expect(b).toBe(a);
  });

  it("you can't message yourself", async () => {
    const { error } = await alice.client.rpc('start_direct_conversation', { p_user_id: alice.id });
    expect(error?.code).toBe('P0001');
  });

  it('only the two people can read or post', async () => {
    const id = await open(alice, bob);
    expect(
      (await alice.client.from('messages').insert({ conversation_id: id, body: 'hey' })).error,
    ).toBeNull();
    expect(
      (await bob.client.from('messages').select('body').eq('conversation_id', id)).data,
    ).toEqual([{ body: 'hey' }]);
    expect(
      (await stranger.client.from('messages').select('id').eq('conversation_id', id)).data,
    ).toEqual([]);
    expect(
      (await stranger.client.from('messages').insert({ conversation_id: id, body: 'spam' })).error
        ?.code,
    ).toBe('42501');
  });

  it('an empty thread is not in the inbox and not unread', async () => {
    const carol = await createUser('dm-carol');
    await open(carol, stranger);
    expect((await stranger.client.rpc('direct_inbox', {})).data).toEqual([]);
    expect((await stranger.client.rpc('unread_direct_count')).data).toBe(0);
    expect((await carol.client.rpc('direct_inbox', {})).data).toEqual([]);
  });

  it('a new message is unread for the recipient until they read it', async () => {
    const dave = await createUser('dm-dave');
    const erin = await createUser('dm-erin');
    const id = await open(dave, erin);
    await dave.client.from('messages').insert({ conversation_id: id, body: 'see you at the meet' });

    expect((await erin.client.rpc('unread_direct_count')).data).toBe(1);
    expect((await dave.client.rpc('unread_direct_count')).data).toBe(0);
    const { data: inbox } = await erin.client.rpc('direct_inbox', {});
    expect(inbox).toHaveLength(1);
    expect(inbox![0]).toMatchObject({
      conversation_id: id,
      other_id: dave.id,
      last_body: 'see you at the meet',
      last_sender_id: dave.id,
      unread: true,
    });

    await erin.client.rpc('mark_conversation_read', { p_conversation_id: id });
    expect((await erin.client.rpc('unread_direct_count')).data).toBe(0);
  });

  it('a block stops new threads and new messages, and hides the thread', async () => {
    const fay = await createUser('dm-fay');
    const gus = await createUser('dm-gus');
    const id = await open(fay, gus);
    await gus.client.from('messages').insert({ conversation_id: id, body: 'hi' });

    expect((await fay.client.from('blocks').insert({ blocked_id: gus.id })).error).toBeNull();

    // Both directions: the blocked person can't send either.
    for (const [from, to] of [
      [gus, fay],
      [fay, gus],
    ] as const) {
      const { error } = await from.client.rpc('start_direct_conversation', { p_user_id: to.id });
      expect(error?.code).toBe('42501');
      const insert = await from.client.from('messages').insert({ conversation_id: id, body: 'x' });
      expect(insert.error?.code).toBe('42501');
      expect((await from.client.rpc('direct_inbox', {})).data).toEqual([]);
      expect((await from.client.rpc('unread_direct_count')).data).toBe(0);
    }

    await fay.client.from('blocks').delete().eq('blocked_id', gus.id);
    expect(
      (await gus.client.from('messages').insert({ conversation_id: id, body: 'sorry' })).error,
    ).toBeNull();
  });

  it("you can report someone else's message, not your own", async () => {
    const hal = await createUser('dm-hal');
    const ivy = await createUser('dm-ivy');
    const id = await open(hal, ivy);
    const { data: msg } = await hal.client
      .from('messages')
      .insert({ conversation_id: id, body: 'buy followers here' })
      .select('id')
      .single();

    const report = (who: TestUser) =>
      who.client
        .from('reports')
        .insert({ target_type: 'message', target_id: msg!.id, reason: 'spam' });
    expect((await report(hal)).error?.code).toBe('42501');
    expect((await report(stranger)).error?.code).toBe('42501');
    expect((await report(ivy)).error).toBeNull();
  });
});
