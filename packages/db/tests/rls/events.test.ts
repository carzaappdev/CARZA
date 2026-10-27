import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, anon, cleanup, createUser, type TestUser } from './helpers';

let host: TestUser;
let guest: TestUser;

beforeAll(async () => {
  host = await createUser('host');
  guest = await createUser('guest');
});
afterAll(cleanup);

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

async function createEvent(user: TestUser, extra: Record<string, unknown> = {}) {
  const { data, error } = await user.client
    .from('events')
    .insert({
      title: 'Cars & Coffee',
      starts_at: inDays(2),
      timezone: 'America/Chicago',
      venue_name: 'Coffee shop',
      postal_code: '78701',
      ...extra,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

describe('events', () => {
  it('are public, hosted by the signed-in user, placed by ZIP, and the host is going', async () => {
    const e = await createEvent(host);
    expect(e.host_id).toBe(host.id);
    expect(e.city).toBe('Austin');
    // The host's RSVP lands in an AFTER trigger, so read the row back.
    const { data } = await anon().from('events').select('going_count').eq('id', e.id);
    expect(data).toEqual([{ going_count: 1 }]);
  });

  it('reject past start times, unknown ZIPs, bad timezones and forged fields', async () => {
    const base = {
      title: 'Meet',
      timezone: 'America/Chicago',
      venue_name: 'Lot',
      postal_code: '78701',
    };
    const tries = [
      { ...base, starts_at: inDays(-1) },
      { ...base, starts_at: inDays(1), postal_code: '00000' },
      { ...base, starts_at: inDays(1), timezone: 'Mars/Olympus' },
      { ...base, starts_at: inDays(1), host_id: guest.id },
      { ...base, starts_at: inDays(1), going_count: 500 },
      { ...base, starts_at: inDays(1), city: 'Elsewhere' },
      { ...base, starts_at: inDays(1), cover_path: `${guest.id}/${randomUUID()}.webp` },
    ];
    for (const row of tries) {
      const { error } = await host.client.from('events').insert(row);
      expect(error, JSON.stringify(row)).not.toBeNull();
    }
  });

  it('only the host can edit or delete', async () => {
    const e = await createEvent(host);
    const { data: edited } = await guest.client
      .from('events')
      .update({ title: 'Hijacked' })
      .eq('id', e.id)
      .select();
    expect(edited).toEqual([]);
    const { data: deleted } = await guest.client.from('events').delete().eq('id', e.id).select();
    expect(deleted).toEqual([]);
    const { error } = await host.client
      .from('events')
      .update({ title: 'Cars & Coffee II' })
      .eq('id', e.id);
    expect(error).toBeNull();
  });

  it('cancelling is final and blocks new RSVPs', async () => {
    const e = await createEvent(host);
    expect(
      (
        await host.client
          .from('events')
          .update({ cancelled_at: inDays(5) })
          .eq('id', e.id)
      ).error,
    ).toBeNull();
    const { data } = await admin.from('events').select('cancelled_at').eq('id', e.id).single();
    expect(new Date(data!.cancelled_at!).getTime()).toBeLessThan(Date.now() + 60_000);
    expect(
      (await host.client.from('events').update({ cancelled_at: null }).eq('id', e.id)).error,
    ).not.toBeNull();
    expect(
      (await guest.client.from('event_rsvps').insert({ event_id: e.id })).error,
    ).not.toBeNull();
  });
});

describe('RSVPs', () => {
  it('count once per person, can be undone, and only by that person', async () => {
    const e = await createEvent(host);
    expect((await guest.client.from('event_rsvps').insert({ event_id: e.id })).error).toBeNull();
    expect(
      (await guest.client.from('event_rsvps').insert({ event_id: e.id })).error,
    ).not.toBeNull();
    const count = async () =>
      (await anon().from('events').select('going_count').eq('id', e.id).single()).data?.going_count;
    expect(await count()).toBe(2);

    const { data: hostRemoves } = await host.client
      .from('event_rsvps')
      .delete()
      .eq('event_id', e.id)
      .eq('user_id', guest.id)
      .select();
    expect(hostRemoves).toEqual([]);
    await guest.client.from('event_rsvps').delete().eq('event_id', e.id).eq('user_id', guest.id);
    expect(await count()).toBe(1);
  });

  it("can't be made for someone else", async () => {
    const e = await createEvent(host);
    const { error } = await host.client
      .from('event_rsvps')
      .insert({ event_id: e.id, user_id: guest.id });
    expect(error).not.toBeNull();
  });

  it('respect capacity', async () => {
    const e = await createEvent(await createUser('host2'), { capacity: 2 });
    expect((await guest.client.from('event_rsvps').insert({ event_id: e.id })).error).toBeNull();
    const third = await createUser('third');
    const { error } = await third.client.from('event_rsvps').insert({ event_id: e.id });
    expect(error?.code).toBe('CZ409');
  });
});

describe('upcoming_events', () => {
  it('finds events near a point, skips cancelled ones, and works signed out', async () => {
    const host3 = await createUser('host3');
    const near = await createEvent(host3);
    const cancelled = await createEvent(host3);
    await host3.client
      .from('events')
      .update({ cancelled_at: inDays(0) })
      .eq('id', cancelled.id);
    const austin = { p_lat: 30.27, p_lng: -97.74, p_radius_miles: 25 };
    const ids = ((await anon().rpc('upcoming_events', austin)).data ?? []).map((e) => e.id);
    expect(ids).toContain(near.id);
    expect(ids).not.toContain(cancelled.id);
    const far = (
      (await anon().rpc('upcoming_events', { p_lat: 40.71, p_lng: -74.0, p_radius_miles: 25 }))
        .data ?? []
    ).map((e) => e.id);
    expect(far).not.toContain(near.id);
  });
});
