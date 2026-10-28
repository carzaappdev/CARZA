import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, cleanup, createUser, type TestUser } from './helpers';

let alice: TestUser;
let bob: TestUser;
let boss: TestUser;
let aliceName: string;

beforeAll(async () => {
  alice = await createUser('alice');
  bob = await createUser('bob');
  boss = await createUser('boss');
  await admin.from('profiles').update({ role: 'admin' }).eq('id', boss.id);
  const { data } = await admin.from('profiles').select('username').eq('id', alice.id).single();
  aliceName = data!.username;
});
afterAll(cleanup);

describe('founding members', () => {
  it('numbers new accounts in order, and nobody can change their number', async () => {
    const { data } = await admin
      .from('profiles')
      .select('id, founding_number')
      .in('id', [alice.id, bob.id]);
    const n = Object.fromEntries(data!.map((p) => [p.id, p.founding_number]));
    // The local seed can hold more than 1,000 people; then nobody new gets a number.
    if (n[alice.id] !== null) expect(n[bob.id]).toBe((n[alice.id] as number) + 1);
    const { error } = await alice.client
      .from('profiles')
      .update({ founding_number: 1 } as never)
      .eq('id', alice.id);
    expect(error?.code).toBe('42501');
  });

  it('follows the inviter once, and never yourself', async () => {
    await alice.client.rpc('accept_invite', { p_username: aliceName });
    await bob.client.rpc('accept_invite', { p_username: aliceName });
    await bob.client.rpc('accept_invite', { p_username: aliceName });
    const { data: follows } = await admin
      .from('follows')
      .select('follower_id')
      .eq('followee_id', alice.id);
    expect(follows!.map((f) => f.follower_id)).toEqual([bob.id]);
    expect((await alice.client.rpc('my_invite_count')).data).toBe(1);
    expect((await bob.client.rpc('my_invite_count')).data).toBe(0);

    // Bob can't later switch who invited him.
    await bob.client.rpc('accept_invite', { p_username: 'nobody_here' });
    const { data: me } = await admin
      .from('profile_private')
      .select('invited_by')
      .eq('user_id', bob.id)
      .single();
    expect(me!.invited_by).toBe(alice.id);
  });

  it('lets only admins feature people', async () => {
    const denied = await alice.client.rpc('set_featured', {
      p_user_id: alice.id,
      p_featured: true,
    });
    expect(denied.error?.code).toBe('42501');
    const direct = await alice.client
      .from('profiles')
      .update({ featured_at: new Date().toISOString() } as never)
      .eq('id', alice.id);
    expect(direct.error?.code).toBe('42501');

    expect(
      (await boss.client.rpc('set_featured', { p_user_id: alice.id, p_featured: true })).error,
    ).toBeNull();
    const { data } = await bob.client.rpc('suggested_follows', { p_limit: 50 });
    expect(data!.find((p) => p.id === alice.id)).toBeUndefined(); // Bob already follows Alice.
    const { data: forBoss } = await boss.client.rpc('suggested_follows', { p_limit: 1 });
    expect(forBoss![0]).toMatchObject({ featured: true });
  });
});
