import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, anon, catalogIds, cleanup, createUser, type TestUser } from './helpers';

let alice: TestUser;
let bob: TestUser;
let car: { make_id: number; model_id: number };

beforeAll(async () => {
  alice = await createUser('alice');
  bob = await createUser('bob');
  const ids = await catalogIds();
  car = { make_id: ids.makeId, model_id: ids.modelId };
});
afterAll(cleanup);

describe('garage', () => {
  it('is public, owned by the signed-in user, and only editable by them', async () => {
    const { data, error } = await alice.client
      .from('garage_cars')
      .insert({ year: 2019, ...car, nickname: 'Blue Steel' })
      .select('id, owner_id')
      .single();
    expect(error).toBeNull();
    expect(data?.owner_id).toBe(alice.id);
    expect((await anon().from('garage_cars').select('id').eq('id', data!.id)).data).toHaveLength(1);

    expect(
      (
        await bob.client
          .from('garage_cars')
          .insert({ year: 2019, ...car, owner_id: alice.id } as never)
      ).error,
    ).not.toBeNull();
    await bob.client.from('garage_cars').update({ nickname: 'hacked' }).eq('id', data!.id);
    await bob.client.from('garage_cars').delete().eq('id', data!.id);
    const { data: after } = await admin
      .from('garage_cars')
      .select('nickname')
      .eq('id', data!.id)
      .single();
    expect(after?.nickname).toBe('Blue Steel');
  });

  it('rejects a model from another make, and caps at 10 cars', async () => {
    const { data: other } = await admin
      .from('vehicle_models')
      .select('id')
      .neq('make_id', car.make_id)
      .limit(1)
      .single();
    expect(
      (
        await bob.client
          .from('garage_cars')
          .insert({ year: 2020, make_id: car.make_id, model_id: other!.id })
      ).error,
    ).not.toBeNull();
    for (let i = 0; i < 10; i++) {
      expect(
        (await bob.client.from('garage_cars').insert({ year: 2000 + i, ...car })).error,
      ).toBeNull();
    }
    expect((await bob.client.from('garage_cars').insert({ year: 2011, ...car })).error?.code).toBe(
      'CZ409',
    );
  });

  it('places you by ZIP: private location, public city', async () => {
    const { error } = await alice.client
      .from('profile_private')
      .update({ postal_code: '78701' })
      .eq('user_id', alice.id);
    expect(error).toBeNull();
    const { data: profile } = await anon()
      .from('profiles')
      .select('city')
      .eq('id', alice.id)
      .single();
    expect(profile?.city).toBeTruthy();
    // Location is derived, never client-set, and nobody else can read it.
    expect(
      (
        await alice.client
          .from('profile_private')
          .update({ location: 'POINT(0 0)' } as never)
          .eq('user_id', alice.id)
      ).error,
    ).not.toBeNull();
    expect(
      (await bob.client.from('profile_private').select('*').eq('user_id', alice.id)).data,
    ).toHaveLength(0);
    expect(
      (
        await alice.client
          .from('profile_private')
          .update({ postal_code: '00000' })
          .eq('user_id', alice.id)
      ).error,
    ).not.toBeNull();
  });

  it('suggests people to follow, never yourself or people you follow', async () => {
    await bob.client.from('profile_private').update({ postal_code: '78701' }).eq('user_id', bob.id);
    const { data } = await alice.client.rpc('suggested_follows', { p_limit: 50 });
    const ids = (data ?? []).map((p) => p.id);
    expect(ids).not.toContain(alice.id);
    expect(ids).toContain(bob.id);
    await alice.client.from('follows').insert({ followee_id: bob.id });
    const { data: again } = await alice.client.rpc('suggested_follows', { p_limit: 50 });
    expect((again ?? []).map((p) => p.id)).not.toContain(bob.id);
  });

  it('onboarding can only be completed for yourself', async () => {
    expect((await alice.client.rpc('complete_onboarding')).error).toBeNull();
    const { data } = await alice.client
      .from('profile_private')
      .select('onboarded_at')
      .eq('user_id', alice.id)
      .single();
    expect(data?.onboarded_at).not.toBeNull();
    expect((await anon().rpc('complete_onboarding')).error).not.toBeNull();
  });
});
