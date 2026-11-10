import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, anon, cleanup, createUser, type TestUser } from './helpers';

let mod: TestUser;
let user: TestUser;
const created: string[] = [];

const request = (extra: Record<string, string> = {}) => ({
  p_kind: 'intimate_image',
  p_name: 'Jamie Rivera',
  p_email: `jamie-${Math.random().toString(36).slice(2)}@Example.com`,
  p_urls: 'https://carza.example/p/123',
  p_statement: 'That is me and I never agreed to this being posted.',
  p_signature: 'Jamie Rivera',
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
  it('can be sent without an account and get a ticket and a 48-hour deadline', async () => {
    const { data: ticket, error } = await anon().rpc('submit_legal_request', request());
    expect(error).toBeNull();
    expect(ticket).toMatch(/^CZ-[0-9A-F]{8}$/);
    created.push(ticket!);
    const { data } = await admin
      .from('legal_requests')
      .select('kind, email, status, due_at, created_at, user_id')
      .eq('ticket', ticket!)
      .single();
    expect(data?.status).toBe('open');
    expect(data?.user_id).toBeNull();
    expect(data?.email).toBe(data?.email.toLowerCase());
    const hours =
      (new Date(data!.due_at!).getTime() - new Date(data!.created_at).getTime()) / 3_600_000;
    expect(Math.round(hours)).toBe(48);
  });

  it('other kinds have no deadline, and a signed-in sender is recorded', async () => {
    const { data: ticket } = await user.client.rpc(
      'submit_legal_request',
      request({ p_kind: 'copyright' }),
    );
    created.push(ticket!);
    const { data } = await admin
      .from('legal_requests')
      .select('due_at, user_id')
      .eq('ticket', ticket!)
      .single();
    expect(data).toEqual({ due_at: null, user_id: user.id });
  });

  it('refuses bad input and direct inserts', async () => {
    const badInputs: Record<string, string>[] = [
      { p_kind: 'nonsense' },
      { p_email: 'not-an-email' },
      { p_statement: 'short' },
      { p_signature: '' },
    ];
    for (const bad of badInputs) {
      expect((await anon().rpc('submit_legal_request', request(bad))).error).not.toBeNull();
    }
    for (const client of [anon(), user.client, mod.client]) {
      const { error } = await client.from('legal_requests').insert({
        kind: 'other',
        name: 'Someone',
        email: 'a@b.co',
        urls: 'https://x.example',
        statement: 'a statement long enough',
        signature: 'Someone',
      });
      expect(error).not.toBeNull();
    }
  });

  it('are readable and resolvable by admins only', async () => {
    const { data: ticket } = await anon().rpc('submit_legal_request', request());
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

  it('limits how many one email address can send in a day', async () => {
    const email = `flood-${Date.now()}@example.com`;
    let refused = 0;
    for (let i = 0; i < 6; i++) {
      const { data, error } = await anon().rpc('submit_legal_request', request({ p_email: email }));
      if (error?.code === 'CZ429') refused += 1;
      else if (data) created.push(data);
    }
    expect(refused).toBe(1);
  });
});
