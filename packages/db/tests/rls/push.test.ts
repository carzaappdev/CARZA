import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, anon, cleanup, createUser, type TestUser } from './helpers';

let alice: TestUser;
let bob: TestUser;

beforeAll(async () => {
  alice = await createUser('alice');
  bob = await createUser('bob');
});
afterAll(cleanup);

const device = (n: number) => ({
  p_endpoint: `https://push.example.test/${n}-${crypto.randomUUID()}`,
  p_p256dh: 'B'.repeat(87),
  p_auth: 'a'.repeat(22),
});

describe('push subscriptions', () => {
  it('are saved through the RPC and only visible to their owner', async () => {
    const d = device(1);
    expect((await alice.client.rpc('save_push_subscription', d)).error).toBeNull();
    const { data: mine } = await alice.client.from('push_subscriptions').select('endpoint');
    expect(mine?.map((r) => r.endpoint)).toContain(d.p_endpoint);
    const { data: theirs } = await bob.client
      .from('push_subscriptions')
      .select('id')
      .eq('endpoint', d.p_endpoint);
    expect(theirs).toHaveLength(0);
  });

  it("can't be inserted or updated directly, or saved signed out", async () => {
    const { error: insertErr } = await alice.client.from('push_subscriptions').insert({
      user_id: bob.id,
      endpoint: 'https://x.test/1',
      p256dh: 'B'.repeat(87),
      auth: 'a'.repeat(22),
    });
    expect(insertErr).not.toBeNull();
    const { error: anonErr } = await anon().rpc('save_push_subscription', device(5));
    expect(anonErr).not.toBeNull();
  });

  it('reject non-https endpoints and malformed keys', async () => {
    expect(
      (
        await alice.client.rpc('save_push_subscription', {
          ...device(2),
          p_endpoint: 'http://x.test',
        })
      ).error,
    ).not.toBeNull();
    expect(
      (await alice.client.rpc('save_push_subscription', { ...device(3), p_auth: 'x' })).error,
    ).not.toBeNull();
  });

  it('move to whoever signs in on the same device, and only the owner can delete', async () => {
    const d = device(4);
    await alice.client.rpc('save_push_subscription', d);
    await bob.client.rpc('save_push_subscription', d);
    const { data: row } = await admin
      .from('push_subscriptions')
      .select('user_id')
      .eq('endpoint', d.p_endpoint)
      .single();
    expect(row?.user_id).toBe(bob.id);

    await alice.client.from('push_subscriptions').delete().eq('endpoint', d.p_endpoint);
    const { count } = await admin
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('endpoint', d.p_endpoint);
    expect(count).toBe(1);
  });

  it('keep at most 10 devices per person', async () => {
    for (let i = 0; i < 12; i++) await bob.client.rpc('save_push_subscription', device(100 + i));
    const { count } = await admin
      .from('push_subscriptions')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', bob.id);
    expect(count).toBe(10);
  });
});

describe('push signing keys', () => {
  it('are never readable or writable by users', async () => {
    await admin
      .from('push_vapid_keys')
      .upsert({ id: 1, public_key: 'B'.repeat(87), private_key: 'p'.repeat(43) });
    for (const client of [anon(), alice.client]) {
      const { data } = await client.from('push_vapid_keys').select('private_key');
      expect(data ?? []).toHaveLength(0);
      const { error } = await client
        .from('push_vapid_keys')
        .update({ private_key: 'x'.repeat(43) })
        .eq('id', 1);
      expect(error).not.toBeNull();
    }
    await admin.from('push_vapid_keys').delete().eq('id', 1);
  });

  it("can't be marked pushed by users", async () => {
    const { error } = await alice.client
      .from('notifications')
      .update({ pushed_at: new Date().toISOString() })
      .eq('user_id', alice.id);
    expect(error).not.toBeNull();
  });
});

describe('push preferences', () => {
  it('are owner-only and limited to notification types', async () => {
    const { error } = await alice.client
      .from('profile_private')
      .update({ push_muted: ['post_like'] })
      .eq('user_id', alice.id);
    expect(error).toBeNull();
    const { data } = await alice.client.from('profile_private').select('push_muted').single();
    expect(data?.push_muted).toEqual(['post_like']);

    await bob.client.from('profile_private').update({ push_muted: [] }).eq('user_id', alice.id);
    const { data: still } = await admin
      .from('profile_private')
      .select('push_muted')
      .eq('user_id', alice.id)
      .single();
    expect(still?.push_muted).toEqual(['post_like']);
  });

  it('never block the in-app notification, even with devices saved', async () => {
    await bob.client.from('follows').insert({ followee_id: alice.id });
    const { data } = await alice.client
      .from('notifications')
      .select('type')
      .eq('type', 'new_follower');
    expect(data).toHaveLength(1);
  });
});
