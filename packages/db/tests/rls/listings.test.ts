import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addMember,
  anon,
  catalogIds,
  cleanup,
  createDealership,
  createListing,
  createUser,
  type TestUser,
  uploadViaReservation,
} from './helpers';

let seller: TestUser;
// Private sellers are limited to 10 new listings/day, so later groups use a second seller.
let seller2: TestUser;
let other: TestUser;
let staffA: TestUser;
let staffB: TestUser;
let pendingStaff: TestUser;
let dealerA: string;
let pendingDealer: string;

beforeAll(async () => {
  [seller, seller2, other, staffA, staffB, pendingStaff] = await Promise.all([
    createUser('seller'),
    createUser('seller2'),
    createUser('other'),
    createUser('staffa'),
    createUser('staffb'),
    createUser('pendingstaff'),
  ]);
  dealerA = await createDealership(staffA);
  await createDealership(staffB);
  pendingDealer = await createDealership(pendingStaff, { verified: false });
});
afterAll(cleanup);

describe('private listings', () => {
  it('active ones are public; drafts are visible only to the seller', async () => {
    const active = await createListing(seller);
    const draft = await createListing(seller, { status: 'draft' });

    const pub = await anon()
      .from('listings')
      .select('id')
      .in('id', [active.listingId, draft.listingId]);
    expect(pub.data?.map((r) => r.id)).toEqual([active.listingId]);

    const asOther = await other.client.from('listings').select('id').eq('id', draft.listingId);
    expect(asOther.data).toEqual([]);

    const asSeller = await seller.client.from('listings').select('id').eq('id', draft.listingId);
    expect(asSeller.data).toHaveLength(1);
  });

  it("can't be edited by someone else", async () => {
    const { listingId } = await createListing(seller);
    const { data } = await other.client
      .from('listings')
      .update({ price_cents: 100 })
      .eq('id', listingId)
      .select();
    expect(data).toEqual([]);
  });

  it("can't be created for someone else's vehicle", async () => {
    const { vehicleId } = await createListing(seller, { status: 'sold' });
    const { error } = await other.client.from('listings').insert({
      vehicle_id: vehicleId,
      seller_user_id: other.id,
      price_cents: 100_00,
      location: 'SRID=4326;POINT(-97.74 30.27)',
      city: 'X',
      region: 'TX',
    });
    expect(error).not.toBeNull();
  });

  it("can't be created in someone else's name", async () => {
    const { makeId, modelId } = await catalogIds();
    const { error } = await other.client.from('vehicles').insert({
      owner_user_id: seller.id,
      year: 2020,
      make_id: makeId,
      model_id: modelId,
      mileage: 1,
    });
    expect(error?.code).toBe('42501');
  });

  it('only drafts can be deleted', async () => {
    const active = await createListing(seller);
    const draft = await createListing(seller, { status: 'draft' });
    const delActive = await seller.client
      .from('listings')
      .delete()
      .eq('id', active.listingId)
      .select();
    expect(delActive.data).toEqual([]);
    const delDraft = await seller.client
      .from('listings')
      .delete()
      .eq('id', draft.listingId)
      .select();
    expect(delDraft.data).toHaveLength(1);
  });

  it('server-managed fields cannot be set by the client', async () => {
    const { listingId } = await createListing(seller);
    const { error } = await seller.client
      .from('listings')
      .update({ published_at: '2000-01-01' })
      .eq('id', listingId);
    expect(error?.code).toBe('42501');
  });

  it('exact location is visible only to the seller', async () => {
    const { listingId } = await createListing(seller);
    const insert = await seller.client
      .from('listing_private_locations')
      .insert({ listing_id: listingId, location: 'SRID=4326;POINT(-97.7431 30.2672)' });
    expect(insert.error).toBeNull();

    expect(
      (
        await seller.client
          .from('listing_private_locations')
          .select('*')
          .eq('listing_id', listingId)
      ).data,
    ).toHaveLength(1);
    expect(
      (await other.client.from('listing_private_locations').select('*').eq('listing_id', listingId))
        .data,
    ).toEqual([]);
    expect((await anon().from('listing_private_locations').select('*')).error?.code).toBe('42501');
  });
});

describe('dealer listings', () => {
  it('unverified dealerships can create drafts but not publish', async () => {
    const draft = await createListing(pendingStaff, {
      dealershipId: pendingDealer,
      status: 'draft',
    });
    const publish = await pendingStaff.client
      .from('listings')
      .update({ status: 'active' })
      .eq('id', draft.listingId)
      .select();
    expect(publish.error?.code).toBe('42501');
    await expect(
      createListing(pendingStaff, { dealershipId: pendingDealer, status: 'active' }),
    ).rejects.toMatchObject({
      code: '42501',
    });
  });

  it("staff can't touch another dealership's inventory", async () => {
    const { listingId } = await createListing(staffA, { dealershipId: dealerA });
    const { data } = await staffB.client
      .from('listings')
      .update({ price_cents: 100 })
      .eq('id', listingId)
      .select();
    expect(data).toEqual([]);
    await expect(createListing(staffB, { dealershipId: dealerA })).rejects.toBeTruthy();
  });

  it('use the dealership location regardless of what the client sends', async () => {
    const { listingId } = await createListing(staffA, { dealershipId: dealerA });
    const { data } = await anon().from('listings').select('city').eq('id', listingId).single();
    expect(data?.city).toBe('Testville');
  });

  it('a listing in a dealership becomes visible to new staff', async () => {
    const newStaff = await createUser('newstaff');
    const { listingId } = await createListing(staffA, { dealershipId: dealerA, status: 'draft' });
    expect((await newStaff.client.from('listings').select('id').eq('id', listingId)).data).toEqual(
      [],
    );
    await addMember(dealerA, newStaff, 'staff');
    expect(
      (await newStaff.client.from('listings').select('id').eq('id', listingId)).data,
    ).toHaveLength(1);
  });
});

describe('listing_photos + storage', () => {
  const png = new Blob([new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])], { type: 'image/png' });

  it('direct client uploads are refused (uploads go through reserve_upload + a signed URL)', async () => {
    const { listingId } = await createListing(seller2);
    const direct = await seller2.client.storage
      .from('listing-photos')
      .upload(`${listingId}/${randomUUID()}.png`, png, { contentType: 'image/png' });
    expect(direct.error).not.toBeNull();
  });

  it('sellers can upload to their listing; others cannot reserve a slot there', async () => {
    const { listingId } = await createListing(seller2);
    const own = await uploadViaReservation(seller2, 'listing-photos', listingId, png);
    expect(own.error).toBeNull();
    expect(own.path).toMatch(new RegExp(`^${listingId}/[0-9a-f-]{36}\\.png$`));

    const intruder = await uploadViaReservation(other, 'listing-photos', listingId, png);
    expect((intruder.error as { code?: string }).code).toBe('42501');
  });

  it('rejects disallowed file types', async () => {
    const { listingId } = await createListing(seller2);
    const svg = new Blob(['<svg/>'], { type: 'image/svg+xml' });
    const { error } = await uploadViaReservation(seller2, 'listing-photos', listingId, svg);
    expect((error as { code?: string }).code).toBe('22023');
  });

  it('photo rows must point inside the listing folder and belong to the seller', async () => {
    const { listingId } = await createListing(seller2);
    const outside = await seller2.client
      .from('listing_photos')
      .insert({ listing_id: listingId, storage_path: `${randomUUID()}/x.webp`, position: 0 });
    expect(outside.error?.code).toBe('23514');

    const traversal = await seller2.client
      .from('listing_photos')
      .insert({ listing_id: listingId, storage_path: `${listingId}/../x.webp`, position: 0 });
    expect(traversal.error?.code).toBe('23514');

    const byOther = await other.client
      .from('listing_photos')
      .insert({ listing_id: listingId, storage_path: `${listingId}/x.webp`, position: 0 });
    expect(byOther.error?.code).toBe('42501');
  });

  it('avatars can only be reserved for your own folder', async () => {
    expect((await uploadViaReservation(seller2, 'avatars', seller2.id, png)).error).toBeNull();
    const notOwn = await uploadViaReservation(seller2, 'avatars', other.id, png);
    expect((notOwn.error as { code?: string }).code).toBe('42501');
  });
});

describe('saved_listings', () => {
  it("are private and can't target hidden listings", async () => {
    const active = await createListing(seller2);
    const draft = await createListing(seller2, { status: 'draft' });
    expect(
      (
        await other.client
          .from('saved_listings')
          .insert({ user_id: other.id, listing_id: active.listingId })
      ).error,
    ).toBeNull();
    expect(
      (
        await other.client
          .from('saved_listings')
          .insert({ user_id: other.id, listing_id: draft.listingId })
      ).error?.code,
    ).toBe('42501');
    expect(
      (
        await other.client
          .from('saved_listings')
          .insert({ user_id: seller2.id, listing_id: active.listingId })
      ).error?.code,
    ).toBe('42501');
    expect(
      (await seller2.client.from('saved_listings').select('*').eq('user_id', other.id)).data,
    ).toEqual([]);
  });
});

describe('search_listings', () => {
  it('never returns drafts or unverified dealer listings', async () => {
    const draft = await createListing(seller2, { status: 'draft' });
    const pending = await createListing(pendingStaff, {
      dealershipId: pendingDealer,
      status: 'draft',
    });
    const active = await createListing(seller2);
    const { data } = await anon().rpc('search_listings', {
      p_lat: 30.27,
      p_lng: -97.74,
      p_radius_miles: 5,
      p_limit: 48,
    });
    const ids = (data ?? []).map((r) => r.listing_id);
    expect(ids).toContain(active.listingId);
    expect(ids).not.toContain(draft.listingId);
    expect(ids).not.toContain(pending.listingId);
  });
});
