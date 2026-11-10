import { createHash } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, anon, cleanup, createUser, type TestUser } from './helpers';

let mod: TestUser;
let user: TestUser;
const created: string[] = [];
const hash = (seed: string) => createHash('sha256').update(seed).digest('hex');
// A fresh "sender" per run so the hourly limit doesn't carry over between runs.
const SENDER = hash(`sender-${Date.now()}`);

const request = (extra: Record<string, string> = {}) => ({
  p_kind: 'intimate_image',
  p_name: 'Jamie Rivera',
  p_email: `jamie-${Math.random().toString(36).slice(2)}@Example.com`,
  p_urls: 'https://carza.example/p/123',
  p_statement: 'That is me and I never agreed to this being posted.',
  p_signature: 'Jamie Rivera',
  p_sender_hash: SENDER,
  ...extra,
});

beforeAll(async () => {
  mod = await createUser('mod');
  user = await createUser('user');
  await admin.from('profiles').update({ role: 'admin' }).eq('id', mod.id);
});
afterAll(async () => {
  if (created.length) await admin.from('legal_requests').delete().in('ticket', created);
  await cleanup();
});

describe('legal requests', () => {
  it('come in through the server only: no user or signed-out caller can file one directly', async () => {
    for (const client of [anon(), user.client, mod.client]) {
      expect((await client.rpc('submit_legal_request', request())).error).not.toBeNull();
    }
  });

  it('get a ticket and, for intimate images, a 48-hour deadline', async () => {
    const { data: ticket, error } = await admin.rpc(
      'submit_legal_request',
      request({ p_email: 'Jamie@Example.com' }),
    );
    expect(error).toBeNull();
    expect(ticket).toMatch(/^CZ-[0-9A-F]{12}$/);
    created.push(ticket!);
    const { data } = await admin
      .from('legal_requests')
      .select('kind, email, status, due_at, created_at, user_id')
      .eq('ticket', ticket!)
      .single();
    expect(data?.status).toBe('open');
    expect(data?.user_id).toBeNull();
    expect(data?.email).toBe('jamie@example.com');
    const hours =
      (new Date(data!.due_at!).getTime() - new Date(data!.created_at).getTime()) / 3_600_000;
    expect(Math.round(hours)).toBe(48);
  });

  it('other kinds have no deadline, and a signed-in sender is recorded', async () => {
    const { data: ticket } = await admin.rpc('submit_legal_request', {
      ...request({ p_kind: 'copyright' }),
      p_user_id: user.id,
    });
    created.push(ticket!);
    const { data } = await admin
      .from('legal_requests')
      .select('due_at, user_id')
      .eq('ticket', ticket!)
      .single();
    expect(data).toEqual({ due_at: null, user_id: user.id });
  });

  it('refuses bad input, tricky characters and direct inserts', async () => {
    const badInputs: Record<string, string>[] = [
      { p_kind: 'nonsense' },
      { p_email: 'not-an-email' },
      // Would add a hidden recipient to the admin's reply.
      { p_email: 'a@b.co?bcc=x@evil.example' },
      { p_statement: 'short' },
      { p_signature: '' },
      { p_name: 'Jamie\nRivera' },
      { p_sender_hash: 'not-a-hash' },
    ];
    for (const bad of badInputs) {
      expect((await admin.rpc('submit_legal_request', request(bad))).error).not.toBeNull();
    }
    for (const client of [anon(), user.client, mod.client]) {
      const { error } = await client.from('legal_requests').insert({
        kind: 'other',
        name: 'Someone',
        email: 'a@b.co',
        urls: 'https://x.example',
        statement: 'a statement long enough',
        signature: 'Someone',
        sender_hash: SENDER,
      });
      expect(error).not.toBeNull();
    }
  });

  it('are readable and resolvable by admins only, and never show the sender hash', async () => {
    const { data: ticket } = await admin.rpc('submit_legal_request', request());
    created.push(ticket!);
    for (const client of [anon(), user.client]) {
      expect((await client.from('legal_requests').select('id')).data ?? []).toEqual([]);
      await client.from('legal_requests').update({ status: 'rejected' }).eq('ticket', ticket!);
    }
    const before = await admin
      .from('legal_requests')
      .select('status')
      .eq('ticket', ticket!)
      .single();
    expect(before.data?.status).toBe('open');

    const seen = await mod.client.from('legal_requests').select('ticket').eq('ticket', ticket!);
    expect(seen.data).toHaveLength(1);
    expect((await mod.client.from('legal_requests').select('sender_hash')).error).not.toBeNull();
    expect(
      (await mod.client.from('legal_requests').update({ status: 'actioned' }).eq('ticket', ticket!))
        .error,
    ).toBeNull();
    const after = await admin
      .from('legal_requests')
      .select('status, resolved_by, resolved_at')
      .eq('ticket', ticket!)
      .single();
    expect(after.data?.status).toBe('actioned');
    expect(after.data?.resolved_by).toBe(mod.id);
    expect(after.data?.resolved_at).toBeTruthy();
  });

  it('limits one sender, even in parallel, without affecting anyone else or any email address', async () => {
    const flooder = hash(`flooder-${Date.now()}`);
    const email = `victim-${Date.now()}@example.com`;
    const results = await Promise.all(
      Array.from({ length: 14 }, () =>
        admin.rpc('submit_legal_request', request({ p_sender_hash: flooder, p_email: email })),
      ),
    );
    for (const r of results) if (r.data) created.push(r.data);
    expect(results.filter((r) => r.data).length).toBe(10);
    expect(results.filter((r) => r.error?.code === 'CZ429').length).toBe(4);

    // Someone else can still file, including under the same email address the flooder used.
    const other = await admin.rpc(
      'submit_legal_request',
      request({ p_sender_hash: hash(`other-${Date.now()}`), p_email: email }),
    );
    expect(other.error).toBeNull();
    created.push(other.data!);
  });
});
