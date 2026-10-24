import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addMember,
  cleanup,
  createDealership,
  createListing,
  createUser,
  type TestUser,
} from './helpers';

let buyer: TestUser;
let buyer2: TestUser;
let stranger: TestUser;
let owner: TestUser;
let staff: TestUser;
let dealerId: string;

const inHours = (h: number) => new Date(Date.now() + h * 3600_000).toISOString();

beforeAll(async () => {
  [buyer, buyer2, stranger, owner, staff] = await Promise.all([
    createUser('tdbuyer'),
    createUser('tdbuyer2'),
    createUser('tdstranger'),
    createUser('tdowner'),
    createUser('tdstaff'),
  ]);
  dealerId = await createDealership(owner);
  await addMember(dealerId, staff, 'staff');
});
afterAll(cleanup);

describe('test drives', () => {
  it('are only available on dealer listings', async () => {
    const privateListing = await createListing(stranger);
    const { error } = await buyer.client.rpc('request_test_drive', {
      p_listing_id: privateListing.listingId,
      p_proposed_times: [inHours(48)],
    });
    expect(error?.code).toBe('P0002');
  });

  it('flow: request → only requester + dealership see it → dealer confirms', async () => {
    const { listingId } = await createListing(owner, { dealershipId: dealerId });
    const { data: id, error } = await buyer.client.rpc('request_test_drive', {
      p_listing_id: listingId,
      p_proposed_times: [inHours(48), inHours(72)],
      p_note: 'Morning works best',
    });
    expect(error).toBeNull();

    expect(
      (await stranger.client.from('test_drive_requests').select('id').eq('id', id!)).data,
    ).toEqual([]);
    expect(
      (await staff.client.from('test_drive_requests').select('id').eq('id', id!)).data,
    ).toHaveLength(1);

    // Requester can't confirm their own request; direct updates are not allowed at all.
    expect(
      (
        await buyer.client.rpc('respond_test_drive', {
          p_request_id: id!,
          p_confirm: true,
          p_time: inHours(48),
        })
      ).error,
    ).not.toBeNull();
    expect(
      (await buyer.client.from('test_drive_requests').update({ status: 'confirmed' }).eq('id', id!))
        .error?.code,
    ).toBe('42501');

    const confirm = await staff.client.rpc('respond_test_drive', {
      p_request_id: id!,
      p_confirm: true,
      p_time: inHours(48),
    });
    expect(confirm.error).toBeNull();
    const { data: row } = await buyer.client
      .from('test_drive_requests')
      .select('status, confirmed_time')
      .eq('id', id!)
      .single();
    expect(row?.status).toBe('confirmed');
  });

  it('the same car cannot be double-booked', async () => {
    const { listingId } = await createListing(owner, { dealershipId: dealerId });
    const slot = inHours(96);
    const { data: a } = await buyer.client.rpc('request_test_drive', {
      p_listing_id: listingId,
      p_proposed_times: [slot],
    });
    const { data: b } = await buyer2.client.rpc('request_test_drive', {
      p_listing_id: listingId,
      p_proposed_times: [slot],
    });
    expect(
      (
        await staff.client.rpc('respond_test_drive', {
          p_request_id: a!,
          p_confirm: true,
          p_time: slot,
        })
      ).error,
    ).toBeNull();
    const clash = await staff.client.rpc('respond_test_drive', {
      p_request_id: b!,
      p_confirm: true,
      p_time: slot,
    });
    expect(clash.error?.code).toBe('23P01');
  });

  it('rejects times in the past', async () => {
    const { listingId } = await createListing(owner, { dealershipId: dealerId });
    const { error } = await buyer2.client.rpc('request_test_drive', {
      p_listing_id: listingId,
      p_proposed_times: [new Date(Date.now() - 3600_000).toISOString()],
    });
    expect(error?.code).toBe('22023');
  });

  it('either side can cancel; strangers cannot', async () => {
    const { listingId } = await createListing(owner, { dealershipId: dealerId });
    const { data: id } = await buyer.client.rpc('request_test_drive', {
      p_listing_id: listingId,
      p_proposed_times: [inHours(30)],
    });
    expect(
      (await stranger.client.rpc('cancel_test_drive', { p_request_id: id! })).error?.code,
    ).toBe('P0002');
    expect((await buyer.client.rpc('cancel_test_drive', { p_request_id: id! })).error).toBeNull();
  });
});
