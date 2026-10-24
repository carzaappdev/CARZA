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
let seller: TestUser;
let stranger: TestUser;
let dealerOwner: TestUser;
let dealerStaff: TestUser;
let rivalStaff: TestUser;
let dealerId: string;

beforeAll(async () => {
  [buyer, seller, stranger, dealerOwner, dealerStaff, rivalStaff] = await Promise.all([
    createUser('buyer'),
    createUser('seller'),
    createUser('stranger'),
    createUser('downer'),
    createUser('dstaff'),
    createUser('rival'),
  ]);
  dealerId = await createDealership(dealerOwner);
  await addMember(dealerId, dealerStaff, 'staff');
  await createDealership(rivalStaff);
});
afterAll(cleanup);

describe('consumer ↔ consumer', () => {
  it('only the two participants can read the thread', async () => {
    const { listingId } = await createListing(seller);
    const { data: convId, error } = await buyer.client.rpc('start_conversation', {
      p_listing_id: listingId,
      p_body: 'Is it available?',
    });
    expect(error).toBeNull();

    expect(
      (await seller.client.from('messages').select('body').eq('conversation_id', convId!)).data,
    ).toHaveLength(1);
    expect(
      (await stranger.client.from('messages').select('*').eq('conversation_id', convId!)).data,
    ).toEqual([]);
    expect(
      (await stranger.client.from('conversations').select('*').eq('id', convId!)).data,
    ).toEqual([]);
  });

  it('outsiders cannot post into a thread', async () => {
    const { listingId } = await createListing(seller);
    const { data: convId } = await buyer.client.rpc('start_conversation', {
      p_listing_id: listingId,
      p_body: 'Hi',
    });
    const { error } = await stranger.client
      .from('messages')
      .insert({ conversation_id: convId!, body: 'spam' });
    expect(error?.code).toBe('42501');
  });

  it('participants cannot impersonate another sender', async () => {
    const { listingId } = await createListing(seller);
    const { data: convId } = await buyer.client.rpc('start_conversation', {
      p_listing_id: listingId,
      p_body: 'Hi',
    });
    const { error } = await buyer.client
      .from('messages')
      .insert({ conversation_id: convId!, body: 'x', sender_id: seller.id });
    expect(error?.code).toBe('42501');
  });

  it('messages cannot be edited or deleted', async () => {
    const { listingId } = await createListing(seller);
    const { data: convId } = await buyer.client.rpc('start_conversation', {
      p_listing_id: listingId,
      p_body: 'Original',
    });
    const { data: msg } = await buyer.client
      .from('messages')
      .select('id')
      .eq('conversation_id', convId!)
      .single();
    expect(
      (await buyer.client.from('messages').update({ body: 'Edited' }).eq('id', msg!.id)).error
        ?.code,
    ).toBe('42501');
    expect((await buyer.client.from('messages').delete().eq('id', msg!.id)).error?.code).toBe(
      '42501',
    );
  });

  it("you can't message yourself or a hidden listing", async () => {
    const own = await createListing(seller);
    const self = await seller.client.rpc('start_conversation', {
      p_listing_id: own.listingId,
      p_body: 'hi',
    });
    expect(self.error).not.toBeNull();
    const draft = await createListing(seller, { status: 'draft' });
    const hidden = await buyer.client.rpc('start_conversation', {
      p_listing_id: draft.listingId,
      p_body: 'hi',
    });
    expect(hidden.error?.code).toBe('P0002');
  });

  it('the recipient gets one unread notification per thread', async () => {
    const { listingId } = await createListing(seller);
    const { data: convId } = await buyer.client.rpc('start_conversation', {
      p_listing_id: listingId,
      p_body: 'One',
    });
    await buyer.client.from('messages').insert({ conversation_id: convId!, body: 'Two' });
    const { data } = await seller.client
      .from('notifications')
      .select('data')
      .eq('type', 'new_message')
      .is('read_at', null)
      .filter('data->>conversation_id', 'eq', convId!);
    expect(data).toHaveLength(1);
    expect((data![0]!.data as { preview: string }).preview).toBe('Two');

    await seller.client.rpc('mark_conversation_read', { p_conversation_id: convId! });
    const after = await seller.client
      .from('notifications')
      .select('id')
      .is('read_at', null)
      .filter('data->>conversation_id', 'eq', convId!);
    expect(after.data).toEqual([]);
  });
});

describe('consumer ↔ dealer', () => {
  it('every member of the dealership sees the lead; rival dealers do not', async () => {
    const { listingId } = await createListing(dealerOwner, { dealershipId: dealerId });
    const { data: convId } = await buyer.client.rpc('start_conversation', {
      p_listing_id: listingId,
      p_body: 'Still there?',
    });

    expect(
      (await dealerStaff.client.from('messages').select('id').eq('conversation_id', convId!)).data,
    ).toHaveLength(1);
    expect(
      (await rivalStaff.client.from('messages').select('id').eq('conversation_id', convId!)).data,
    ).toEqual([]);

    const reply = await dealerStaff.client
      .from('messages')
      .insert({ conversation_id: convId!, body: 'Yes!' });
    expect(reply.error).toBeNull();
    expect(
      (await buyer.client.from('messages').select('id').eq('conversation_id', convId!)).data,
    ).toHaveLength(2);
  });

  it('staff cannot message about their own inventory', async () => {
    const { listingId } = await createListing(dealerOwner, { dealershipId: dealerId });
    const { error } = await dealerStaff.client.rpc('start_conversation', {
      p_listing_id: listingId,
      p_body: 'hi',
    });
    expect(error).not.toBeNull();
  });
});

describe('notifications', () => {
  it('are private and only read_at can change', async () => {
    const { listingId } = await createListing(seller);
    await buyer.client.rpc('start_conversation', { p_listing_id: listingId, p_body: 'ping' });
    const { data: mine } = await seller.client.from('notifications').select('id').limit(1).single();
    expect(
      (await stranger.client.from('notifications').select('*').eq('id', mine!.id)).data,
    ).toEqual([]);
    expect(
      (
        await seller.client
          .from('notifications')
          .update({ type: 'dealership_verified' })
          .eq('id', mine!.id)
      ).error?.code,
    ).toBe('42501');
    expect(
      (
        await seller.client
          .from('notifications')
          .update({ read_at: new Date().toISOString() })
          .eq('id', mine!.id)
      ).error,
    ).toBeNull();
    expect(
      (
        await stranger.client
          .from('notifications')
          .insert({ user_id: stranger.id, type: 'new_message' })
      ).error?.code,
    ).toBe('42501');
  });
});
