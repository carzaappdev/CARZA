import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anon, cleanup, createUser, type TestUser } from './helpers';

let alice: TestUser;
let bob: TestUser;

beforeAll(async () => {
  alice = await createUser('alice');
  bob = await createUser('bob');
});
afterAll(cleanup);

describe('profiles', () => {
  it('are created on signup with a username that does not leak the email', async () => {
    const { data } = await alice.client.from('profiles').select('*').eq('id', alice.id).single();
    expect(data?.display_name).toBe('Test alice');
    expect(data?.role).toBe('user');
    expect(data?.username).toMatch(/^[a-z0-9_]{3,30}$/);
    expect(data?.username).not.toContain(alice.email.split('@')[0]);
  });

  it('are readable by anyone', async () => {
    const { data } = await anon().from('profiles').select('id, username').eq('id', alice.id);
    expect(data).toHaveLength(1);
  });

  it('can be updated by their owner', async () => {
    const { error } = await alice.client.from('profiles').update({ bio: 'Hi' }).eq('id', alice.id);
    expect(error).toBeNull();
  });

  it("can't be updated by someone else", async () => {
    const { data } = await bob.client
      .from('profiles')
      .update({ bio: 'hacked' })
      .eq('id', alice.id)
      .select();
    expect(data).toEqual([]);
  });

  it("can't have their role changed by the user", async () => {
    const { error } = await alice.client
      .from('profiles')
      .update({ role: 'admin' })
      .eq('id', alice.id);
    expect(error?.code).toBe('42501');
  });
});

describe('profile_private', () => {
  it('is readable only by its owner', async () => {
    const own = await alice.client.from('profile_private').select('*').eq('user_id', alice.id);
    expect(own.data).toHaveLength(1);
    const other = await bob.client.from('profile_private').select('*').eq('user_id', alice.id);
    expect(other.data).toEqual([]);
    const pub = await anon().from('profile_private').select('*');
    expect(pub.error?.code).toBe('42501');
  });

  it("can't be modified by someone else", async () => {
    const { data } = await bob.client
      .from('profile_private')
      .update({ postal_code: '00000' })
      .eq('user_id', alice.id)
      .select();
    expect(data).toEqual([]);
  });
});
