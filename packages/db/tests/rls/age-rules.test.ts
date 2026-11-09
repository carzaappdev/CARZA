import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, anon, bornYearsAgo, cleanup, createUser, type TestUser } from './helpers';

let adult: TestUser;
let adult2: TestUser;
let teen: TestUser;
let teen2: TestUser;
let noAge: TestUser;

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();
const event = (extra: Record<string, unknown> = {}) => ({
  title: 'Cars & Coffee',
  starts_at: inDays(2),
  timezone: 'America/Chicago',
  venue_name: 'Coffee shop',
  postal_code: '78701',
  ...extra,
});

beforeAll(async () => {
  adult = await createUser('adult');
  adult2 = await createUser('adult2');
  teen = await createUser('teen', undefined, { birthDate: bornYearsAgo(15) });
  teen2 = await createUser('teen2', undefined, { birthDate: bornYearsAgo(16) });
  noAge = await createUser('noage', undefined, { birthDate: null });
});
afterAll(cleanup);

describe('date of birth', () => {
  it('is saved from sign-up, private, and reported as an age group', async () => {
    expect((await adult.client.rpc('my_age_group')).data).toBe('adult');
    expect((await teen.client.rpc('my_age_group')).data).toBe('teen');
    expect((await noAge.client.rpc('my_age_group')).data).toBeNull();
    const { data } = await adult.client.from('profile_private').select('user_id, birth_date');
    expect(data?.map((r) => r.user_id)).toEqual([adult.id]);
    expect(data?.[0]?.birth_date).toBe(bornYearsAgo(30));
  });

  it('refuses a sign-up under 13', async () => {
    const { error } = await admin.auth.admin.createUser({
      email: `kid-${Date.now()}@rls.test`,
      password: 'pw-123456789a',
      email_confirm: true,
      user_metadata: { display_name: 'Kid', birth_date: bornYearsAgo(12) },
    });
    expect(error).not.toBeNull();
  });

  it("can't be written directly, only set once through the age check", async () => {
    const direct = await noAge.client
      .from('profile_private')
      .update({ birth_date: bornYearsAgo(40) } as never)
      .eq('user_id', noAge.id);
    expect(direct.error).not.toBeNull();

    // Nothing can be created before the age check, even straight through the API.
    expect((await noAge.client.from('posts').insert({ body: 'hi' })).error?.code).toBe('42501');
    expect((await noAge.client.from('follows').insert({ followee_id: adult.id })).error?.code).toBe(
      '42501',
    );
    expect(
      (await noAge.client.rpc('start_direct_conversation', { p_user_id: teen.id })).error?.code,
    ).toBe('42501');
    expect((await noAge.client.rpc('can_message', { p_user_id: teen.id })).data).toBe(false);
    expect((await noAge.client.rpc('can_message', { p_user_id: adult.id })).data).toBe(false);

    expect(
      (await noAge.client.rpc('set_birth_date', { p_birth_date: '2999-01-01' })).error?.code,
    ).toBe('22023');
    expect(
      (await noAge.client.rpc('set_birth_date', { p_birth_date: bornYearsAgo(20) })).data,
    ).toBe('ok');
    expect((await noAge.client.rpc('my_age_group')).data).toBe('adult');
    // No second go: an adult can't become a teen or the other way round.
    expect(
      (await noAge.client.rpc('set_birth_date', { p_birth_date: bornYearsAgo(15) })).error?.code,
    ).toBe('42501');
    // Even an under-13 date can't delete (or change) an account that already passed.
    expect(
      (await noAge.client.rpc('set_birth_date', { p_birth_date: bornYearsAgo(10) })).error?.code,
    ).toBe('42501');
    expect((await noAge.client.rpc('my_age_group')).data).toBe('adult');
    expect((await noAge.client.from('posts').insert({ body: 'hi' })).error).toBeNull();
    expect(
      (await anon().rpc('set_birth_date', { p_birth_date: bornYearsAgo(20) })).error,
    ).not.toBeNull();
  });

  it('deletes the account when the age check says under 13', async () => {
    const kid = await createUser('kid', undefined, { birthDate: null });
    expect((await kid.client.rpc('set_birth_date', { p_birth_date: bornYearsAgo(11) })).data).toBe(
      'under_age',
    );
    const { data } = await admin.from('profiles').select('id').eq('id', kid.id);
    expect(data).toEqual([]);
  });
});

describe('messages between adults and teens', () => {
  it('are refused in both directions, and allowed within an age group', async () => {
    expect((await adult.client.rpc('can_message', { p_user_id: teen.id })).data).toBe(false);
    expect((await teen.client.rpc('can_message', { p_user_id: adult.id })).data).toBe(false);
    expect((await adult.client.rpc('can_message', { p_user_id: adult2.id })).data).toBe(true);
    expect((await teen.client.rpc('can_message', { p_user_id: teen2.id })).data).toBe(true);

    expect(
      (await adult.client.rpc('start_direct_conversation', { p_user_id: teen.id })).error?.code,
    ).toBe('42501');
    expect(
      (await teen.client.rpc('start_direct_conversation', { p_user_id: adult.id })).error?.code,
    ).toBe('42501');

    const thread = await teen.client.rpc('start_direct_conversation', { p_user_id: teen2.id });
    expect(thread.error).toBeNull();
    const sent = await teen.client
      .from('messages')
      .insert({ conversation_id: thread.data!, body: 'hey' });
    expect(sent.error).toBeNull();
  });

  it('stop in a thread that existed before one side counted as an adult', async () => {
    // A thread between two adults, then one of them turns out to be a teen (set as admin here).
    const thread = await adult.client.rpc('start_direct_conversation', { p_user_id: adult2.id });
    expect(thread.error).toBeNull();
    await admin
      .from('profile_private')
      .update({ birth_date: bornYearsAgo(16) })
      .eq('user_id', adult2.id);
    const sent = await adult.client
      .from('messages')
      .insert({ conversation_id: thread.data!, body: 'still there?' });
    expect(sent.error?.code).toBe('42501');
    await admin
      .from('profile_private')
      .update({ birth_date: bornYearsAgo(30) })
      .eq('user_id', adult2.id);
  });
});

describe('events and age', () => {
  it("teens can't host", async () => {
    const { error } = await teen.client.from('events').insert(event());
    expect(error?.code).toBe('CZ018');
  });

  it('18+ events are hidden from teens and closed to their RSVPs; all-ages events are open', async () => {
    const open = await adult.client.from('events').insert(event()).select('id').single();
    const adults = await adult.client
      .from('events')
      .insert(event({ title: 'Late night meet', adults_only: true }))
      .select('id')
      .single();
    expect(open.error).toBeNull();
    expect(adults.error).toBeNull();

    const seenByTeen = await teen.client
      .from('events')
      .select('id')
      .in('id', [open.data!.id, adults.data!.id]);
    expect(seenByTeen.data?.map((e) => e.id)).toEqual([open.data!.id]);
    const seenByAdult = await adult2.client
      .from('events')
      .select('id')
      .in('id', [open.data!.id, adults.data!.id]);
    expect(seenByAdult.data).toHaveLength(2);
    const listed = await teen.client.rpc('upcoming_events', {});
    expect(listed.data?.some((e) => e.id === adults.data!.id)).toBe(false);

    expect(
      (await teen.client.from('event_rsvps').insert({ event_id: adults.data!.id })).error?.code,
    ).toBe('CZ018');
    expect(
      (await teen.client.from('event_rsvps').insert({ event_id: open.data!.id })).error,
    ).toBeNull();
    expect(
      (await adult2.client.from('event_rsvps').insert({ event_id: adults.data!.id })).error,
    ).toBeNull();

    // Signed-out visitors don't see 18+ events either.
    const seenSignedOut = await anon()
      .from('events')
      .select('id')
      .in('id', [open.data!.id, adults.data!.id]);
    expect(seenSignedOut.data?.map((e) => e.id)).toEqual([open.data!.id]);

    // Teens can't post on an 18+ event's wall, and turning an event 18+ takes them off the guest list.
    expect(
      (await teen.client.from('posts').insert({ body: 'see you there', event_id: adults.data!.id }))
        .error,
    ).not.toBeNull();
    expect(
      (await adult.client.from('events').update({ adults_only: true }).eq('id', open.data!.id))
        .error,
    ).toBeNull();
    const { data: guests } = await admin
      .from('event_rsvps')
      .select('user_id')
      .eq('event_id', open.data!.id);
    expect(guests?.map((g) => g.user_id)).toEqual([adult.id]);
  });
});
