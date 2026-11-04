import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { anon, catalogIds, cleanup, createUser, type TestUser } from './helpers';

let host: TestUser;
let guest: TestUser;
let other: TestUser;
let eventId: string;
const guestCars: string[] = [];
let otherCar: string;

const inDays = (d: number) => new Date(Date.now() + d * 86_400_000).toISOString();

async function addCar(user: TestUser) {
  const { makeId, modelId } = await catalogIds();
  const { data, error } = await user.client
    .from('garage_cars')
    .insert({ year: 2020, make_id: makeId, model_id: modelId })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

async function carsOf(user: TestUser) {
  const { data, error } = await anon()
    .from('event_rsvp_cars')
    .select('car_id')
    .eq('event_id', eventId)
    .eq('user_id', user.id);
  if (error) throw error;
  return data.map((r) => r.car_id).sort();
}

beforeAll(async () => {
  host = await createUser('host');
  guest = await createUser('guest');
  other = await createUser('other');
  const { data, error } = await host.client
    .from('events')
    .insert({
      title: 'Cars & Coffee',
      starts_at: inDays(2),
      timezone: 'America/Chicago',
      venue_name: 'Coffee shop',
      postal_code: '78701',
    })
    .select('id')
    .single();
  if (error) throw error;
  eventId = data.id;
  for (let i = 0; i < 4; i++) guestCars.push(await addCar(guest));
  otherCar = await addCar(other);
});
afterAll(cleanup);

describe('event_rsvp_cars', () => {
  it('needs an RSVP first', async () => {
    const { error } = await guest.client.rpc('set_event_rsvp_cars', {
      p_event_id: eventId,
      p_car_ids: [guestCars[0]!],
    });
    expect(error?.code).toBe('23503');
  });

  it('lets a guest bring up to 3 of their own cars, publicly listed', async () => {
    expect((await guest.client.from('event_rsvps').insert({ event_id: eventId })).error).toBeNull();
    const three = guestCars.slice(0, 3);
    const { error } = await guest.client.rpc('set_event_rsvp_cars', {
      p_event_id: eventId,
      p_car_ids: three,
    });
    expect(error).toBeNull();
    expect(await carsOf(guest)).toEqual([...three].sort());
    // Saving the same 3 again (a double tap) is fine.
    const again = await guest.client.rpc('set_event_rsvp_cars', {
      p_event_id: eventId,
      p_car_ids: three,
    });
    expect(again.error).toBeNull();
    expect(await carsOf(guest)).toEqual([...three].sort());
  });

  it('refuses a 4th car, through the RPC or a direct insert', async () => {
    const rpc = await guest.client.rpc('set_event_rsvp_cars', {
      p_event_id: eventId,
      p_car_ids: guestCars,
    });
    expect(rpc.error?.code).toBe('CZ409');
    const direct = await guest.client
      .from('event_rsvp_cars')
      .insert({ event_id: eventId, car_id: guestCars[3]! });
    expect(direct.error?.code).toBe('CZ409');
  });

  it('replaces the set in one call', async () => {
    const { error } = await guest.client.rpc('set_event_rsvp_cars', {
      p_event_id: eventId,
      p_car_ids: [guestCars[3]!],
    });
    expect(error).toBeNull();
    expect(await carsOf(guest)).toEqual([guestCars[3]]);
  });

  it("won't take someone else's car", async () => {
    const { error } = await guest.client
      .from('event_rsvp_cars')
      .insert({ event_id: eventId, car_id: otherCar });
    expect(error?.code).toBe('23503');
  });

  it("can't be written as someone else, or removed by them", async () => {
    const forged = await other.client
      .from('event_rsvp_cars')
      .insert({ event_id: eventId, car_id: guestCars[0]!, user_id: guest.id } as never);
    expect(forged.error).not.toBeNull();
    await other.client.from('event_rsvp_cars').delete().eq('user_id', guest.id);
    await anon().from('event_rsvp_cars').delete().eq('user_id', guest.id);
    expect(await carsOf(guest)).toEqual([guestCars[3]]);
  });

  it('drops the cars when the RSVP is cancelled or the car leaves the garage', async () => {
    expect(
      (
        await guest.client.rpc('set_event_rsvp_cars', {
          p_event_id: eventId,
          p_car_ids: guestCars.slice(0, 2),
        })
      ).error,
    ).toBeNull();
    await guest.client.from('garage_cars').delete().eq('id', guestCars[0]!);
    expect(await carsOf(guest)).toEqual([guestCars[1]]);
    await guest.client.from('event_rsvps').delete().eq('event_id', eventId).eq('user_id', guest.id);
    expect(await carsOf(guest)).toEqual([]);
  });

  it('hides a blocked person’s cars', async () => {
    expect((await other.client.from('event_rsvps').insert({ event_id: eventId })).error).toBeNull();
    expect(
      (
        await other.client.rpc('set_event_rsvp_cars', {
          p_event_id: eventId,
          p_car_ids: [otherCar],
        })
      ).error,
    ).toBeNull();
    expect((await host.client.from('blocks').insert({ blocked_id: other.id })).error).toBeNull();
    const { data } = await host.client
      .from('event_rsvp_cars')
      .select('car_id')
      .eq('event_id', eventId);
    expect(data).toEqual([]);
  });

  it('is closed to signed-out callers', async () => {
    const { error } = await anon().rpc('set_event_rsvp_cars', {
      p_event_id: eventId,
      p_car_ids: [],
    });
    expect(error).not.toBeNull();
  });
});
