import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { admin, anon, cleanup, createUser, type TestUser } from './helpers';

let alice: TestUser;
let bob: TestUser;
let miata: { make_id: number; model_id: number };
let aliceCar: string;

async function model(make: string, name: string) {
  const { data } = await admin
    .from('vehicle_models')
    .select('id, make_id, make:vehicle_makes!inner ( name )')
    .eq('name', name)
    .eq('make.name', make)
    .single();
  return { make_id: data!.make_id, model_id: data!.id };
}

const photo = (owner: string) => `${owner}/${randomUUID()}.webp`;

beforeAll(async () => {
  alice = await createUser('alice');
  bob = await createUser('bob');
  miata = await model('Mazda', 'MX-5 Miata');
  const { data, error } = await alice.client
    .from('garage_cars')
    .insert({ year: 2019, ...miata, trim_level: 'Club', story: 'Bought it with 20k miles.' })
    .select('id')
    .single();
  expect(error).toBeNull();
  aliceCar = data!.id;
});
afterAll(cleanup);

describe('my garage', () => {
  it('keeps gallery photos inside the owner’s folder, up to 7', async () => {
    const own = Array.from({ length: 7 }, () => photo(alice.id));
    expect(
      (await alice.client.from('garage_cars').update({ gallery_paths: own }).eq('id', aliceCar))
        .error,
    ).toBeNull();
    expect(
      (
        await alice.client
          .from('garage_cars')
          .update({ gallery_paths: [...own, photo(alice.id)] })
          .eq('id', aliceCar)
      ).error,
    ).not.toBeNull();
    expect(
      (
        await alice.client
          .from('garage_cars')
          .update({ gallery_paths: [photo(alice.id), photo(bob.id)] })
          .eq('id', aliceCar)
      ).error,
    ).not.toBeNull();
  });

  it('only lets owners add and remove mods, which everyone can see', async () => {
    const { data: mod, error } = await alice.client
      .from('garage_mods')
      .insert({ car_id: aliceCar, category: 'suspension', name: 'Coilovers' })
      .select('id, owner_id')
      .single();
    expect(error).toBeNull();
    expect(mod?.owner_id).toBe(alice.id);
    expect((await anon().from('garage_mods').select('id').eq('id', mod!.id)).data).toHaveLength(1);

    // Someone else's car, even when claiming to be the owner.
    expect(
      (
        await bob.client
          .from('garage_mods')
          .insert({ car_id: aliceCar, category: 'brakes', name: 'Big brakes' })
      ).error,
    ).not.toBeNull();
    expect(
      (
        await bob.client
          .from('garage_mods')
          .insert({ car_id: aliceCar, owner_id: alice.id, category: 'brakes', name: 'x' } as never)
      ).error,
    ).not.toBeNull();
    await bob.client.from('garage_mods').delete().eq('id', mod!.id);
    expect((await admin.from('garage_mods').select('id').eq('id', mod!.id)).data).toHaveLength(1);

    expect((await alice.client.from('garage_mods').delete().eq('id', mod!.id)).error).toBeNull();
    expect((await admin.from('garage_mods').select('id').eq('id', mod!.id)).data).toHaveLength(0);
  });

  it('removes a car’s mods with the car', async () => {
    const { data: car } = await alice.client
      .from('garage_cars')
      .insert({ year: 2001, ...miata })
      .select('id')
      .single();
    await alice.client
      .from('garage_mods')
      .insert({ car_id: car!.id, category: 'care', name: 'Wax' });
    await alice.client.from('garage_cars').delete().eq('id', car!.id);
    expect((await admin.from('garage_mods').select('id').eq('car_id', car!.id)).data).toHaveLength(
      0,
    );
  });

  it('keeps the parts catalog read-only', async () => {
    expect((await anon().from('parts').select('id').limit(1)).data).toHaveLength(1);
    expect(
      (
        await alice.client
          .from('parts')
          .insert({ slug: 'x', category: 'care', brand: 'x', name: 'x', blurb: 'x' } as never)
      ).error,
    ).not.toBeNull();
    expect(
      (await alice.client.from('part_fitments').insert({ part_id: 1 } as never)).error,
    ).not.toBeNull();
  });

  it('matches parts by model and year, model-specific first, and marks installed ones', async () => {
    const { data, error } = await anon().rpc('parts_for_car', { p_car_id: aliceCar });
    expect(error).toBeNull();
    const slugs = data!.map((p) => p.slug);
    expect(slugs).toContain('racing-beat-catback'); // ND Miata (2016+)
    expect(slugs).toContain('bluedriver-obd2'); // any 1996+ car
    expect(slugs).not.toContain('bilstein-5100'); // trucks only
    expect(data![0]!.fit).toBe('model');
    expect(data!.at(-1)!.fit).toBe('universal');

    await alice.client.from('garage_mods').insert({
      car_id: aliceCar,
      category: 'intake_exhaust',
      name: 'racing beat cat-back exhaust',
    });
    const { data: after } = await anon().rpc('parts_for_car', { p_car_id: aliceCar });
    expect(after!.find((p) => p.slug === 'racing-beat-catback')?.installed).toBe(true);

    // Year ranges count: a 1995 Miata predates the ND exhaust and the 1996+ OBD2 scanner.
    const { data: old } = await bob.client
      .from('garage_cars')
      .insert({ year: 1995, ...miata })
      .select('id')
      .single();
    const { data: oldParts } = await anon().rpc('parts_for_car', { p_car_id: old!.id });
    const oldSlugs = oldParts!.map((p) => p.slug);
    expect(oldSlugs).toContain('flyin-miata-suspension');
    expect(oldSlugs).not.toContain('racing-beat-catback');
    expect(oldSlugs).not.toContain('bluedriver-obd2');
  });

  it('hides a blocked person’s car, mods and parts', async () => {
    await alice.client.from('blocks').insert({ blocked_id: bob.id });
    expect(
      (await bob.client.from('garage_cars').select('id').eq('id', aliceCar)).data,
    ).toHaveLength(0);
    expect(
      (await bob.client.from('garage_mods').select('id').eq('car_id', aliceCar)).data,
    ).toHaveLength(0);
    expect((await bob.client.rpc('parts_for_car', { p_car_id: aliceCar })).data).toHaveLength(0);
  });
});
