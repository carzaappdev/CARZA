// Regression tests for issues found in the stage-2 security audit and code review.
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addMember,
  admin,
  anon,
  catalogIds,
  cleanup,
  createDealership,
  createListing,
  createUser,
  type TestUser,
  uploadViaReservation,
} from './helpers';

let owner: TestUser;
let staff: TestUser;
let seller: TestUser;
let buyer: TestUser;
let dealerId: string;

beforeAll(async () => {
  [owner, staff, seller, buyer] = await Promise.all([
    createUser('howner'),
    createUser('hstaff'),
    createUser('hseller'),
    createUser('hbuyer'),
  ]);
  dealerId = await createDealership(owner);
  await addMember(dealerId, staff, 'staff');
});
afterAll(cleanup);

const setStatus = (id: string, status: 'verified' | 'suspended' | 'pending') =>
  admin.from('dealerships').update({ verification_status: status }).eq('id', id);

describe('private seller location', () => {
  it('is always snapped to the grid in public, whatever the client sends', async () => {
    const { listingId } = await createListing(seller);
    await seller.client
      .from('listings')
      .update({ location: 'SRID=4326;POINT(-97.743123 30.267153)' })
      .eq('id', listingId);
    const { data } = await admin.rpc('search_listings', {
      p_lat: 30.267153,
      p_lng: -97.743123,
      p_radius_miles: 5,
      p_limit: 48,
    });
    const row = (data ?? []).find((r) => r.listing_id === listingId);
    expect(row).toBeDefined();
    // Exact point would be ~0 m away; the snapped cell center is some distance off.
    expect(row!.distance_m).toBeGreaterThan(10);
  });
});

describe('vehicles', () => {
  it("can't be deleted while they back a published listing (drafts are fine)", async () => {
    const live = await createListing(seller);
    const del = await seller.client.from('vehicles').delete().eq('id', live.vehicleId).select();
    expect(del.data).toEqual([]);
    expect((await anon().from('listings').select('id').eq('id', live.listingId)).data).toHaveLength(
      1,
    );

    const draft = await createListing(seller, { status: 'draft' });
    const delDraft = await seller.client
      .from('vehicles')
      .delete()
      .eq('id', draft.vehicleId)
      .select();
    expect(delDraft.data).toHaveLength(1);
  });

  it("ownership can't be changed and ids can't be chosen by the client", async () => {
    const { makeId, modelId } = await catalogIds();
    const { data: v } = await staff.client
      .from('vehicles')
      .insert({
        owner_dealership_id: dealerId,
        year: 2021,
        make_id: makeId,
        model_id: modelId,
        mileage: 10,
      })
      .select('id')
      .single();
    const steal = await staff.client
      .from('vehicles')
      .update({ owner_dealership_id: null, owner_user_id: staff.id })
      .eq('id', v!.id);
    expect(steal.error?.code).toBe('42501');

    const chooseId = await seller.client.from('vehicles').insert({
      id: randomUUID(),
      owner_user_id: seller.id,
      year: 2021,
      make_id: makeId,
      model_id: modelId,
      mileage: 1,
    });
    expect(chooseId.error?.code).toBe('42501');
  });
});

describe('suspended dealerships', () => {
  it('keep read access but cannot message, respond to test drives, or edit inventory', async () => {
    const o = await createUser('sowner');
    const s = await createUser('sstaff');
    const b = await createUser('sbuyer');
    const id = await createDealership(o);
    await addMember(id, s, 'staff');
    const { listingId } = await createListing(o, { dealershipId: id });
    const { data: convId } = await b.client.rpc('start_conversation', {
      p_listing_id: listingId,
      p_body: 'Hi',
    });
    const { data: driveId } = await b.client.rpc('request_test_drive', {
      p_listing_id: listingId,
      p_proposed_times: [new Date(Date.now() + 48 * 3600_000).toISOString()],
    });

    await setStatus(id, 'suspended');

    expect(
      (await s.client.from('messages').select('id').eq('conversation_id', convId!)).data,
    ).toHaveLength(1);
    expect(
      (await s.client.from('messages').insert({ conversation_id: convId!, body: 'Pay by Zelle' }))
        .error?.code,
    ).toBe('42501');
    const respond = await s.client.rpc('respond_test_drive', {
      p_request_id: driveId!,
      p_confirm: true,
      p_time: new Date(Date.now() + 48 * 3600_000).toISOString(),
    });
    expect(respond.error).not.toBeNull();
    expect(
      (await s.client.from('listings').update({ price_cents: 100 }).eq('id', listingId).select())
        .data,
    ).toEqual([]);
  });
});

describe('dealership verification', () => {
  it('changing the business identity sends a verified dealership back to pending', async () => {
    const o = await createUser('rowner');
    const id = await createDealership(o);
    await o.client.from('dealerships').update({ description: 'Now with more cars' }).eq('id', id);
    expect(
      (await admin.from('dealerships').select('verification_status').eq('id', id).single()).data
        ?.verification_status,
    ).toBe('verified');
    await o.client.from('dealerships').update({ website: 'https://evil.example' }).eq('id', id);
    expect(
      (await admin.from('dealerships').select('verification_status').eq('id', id).single()).data
        ?.verification_status,
    ).toBe('pending');
  });

  it('app admins can verify through the RPC', async () => {
    const appAdmin = await createUser('appadmin');
    await admin.from('profiles').update({ role: 'admin' }).eq('id', appAdmin.id);
    const o = await createUser('vowner');
    const id = await createDealership(o, { verified: false });
    const { error } = await appAdmin.client.rpc('set_dealership_verification', {
      p_dealership_id: id,
      p_status: 'verified',
    });
    expect(error).toBeNull();
    const { data: notes } = await o.client
      .from('notifications')
      .select('type')
      .eq('type', 'dealership_verified');
    expect(notes).toHaveLength(1);
  });
});

describe('ownership and account deletion', () => {
  it('the last owner cannot demote themselves', async () => {
    const o = await createUser('downer');
    const id = await createDealership(o);
    const { error } = await o.client
      .from('dealership_members')
      .update({ role: 'staff' })
      .eq('dealership_id', id)
      .eq('user_id', o.id);
    expect(error?.message).toMatch(/at least one owner/);
  });

  it("deleting the last owner's account works and suspends the dealership", async () => {
    const o = await createUser('delowner');
    const id = await createDealership(o);
    const { error } = await admin.auth.admin.deleteUser(o.id);
    expect(error).toBeNull();
    const { data } = await admin
      .from('dealerships')
      .select('verification_status')
      .eq('id', id)
      .single();
    expect(data?.verification_status).toBe('suspended');
  });
});

describe('invitations', () => {
  it('expired invitations cannot be accepted', async () => {
    const invitee = await createUser('expired');
    const { data: token } = await owner.client.rpc('create_dealership_invitation', {
      p_dealership_id: dealerId,
      p_email: invitee.email,
      p_role: 'staff',
    });
    await admin
      .from('dealership_invitations')
      .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
      .eq('dealership_id', dealerId)
      .eq('email', invitee.email);
    const { error } = await invitee.client.rpc('accept_dealership_invitation', { p_token: token! });
    expect(error?.message).toMatch(/invalid or has expired/);
  });

  it("a removed admin's open invitations are revoked", async () => {
    const dAdmin = await createUser('leaving');
    await addMember(dealerId, dAdmin, 'admin');
    const { data: token } = await dAdmin.client.rpc('create_dealership_invitation', {
      p_dealership_id: dealerId,
      p_email: `alt-${randomUUID().slice(0, 6)}@rls.test`,
      p_role: 'admin',
    });
    expect(token).toBeTruthy();
    await owner.client
      .from('dealership_members')
      .delete()
      .eq('dealership_id', dealerId)
      .eq('user_id', dAdmin.id);
    const { data } = await owner.client
      .from('dealership_invitations')
      .select('id')
      .eq('invited_by', dAdmin.id);
    expect(data).toEqual([]);
  });
});

describe('dealer inbox read state', () => {
  it('reading a lead clears the unread badge for every team member', async () => {
    const { listingId } = await createListing(owner, { dealershipId: dealerId });
    const { data: convId } = await buyer.client.rpc('start_conversation', {
      p_listing_id: listingId,
      p_body: 'Hello team',
    });
    const unread = (u: TestUser) =>
      u.client
        .from('notifications')
        .select('id')
        .is('read_at', null)
        .filter('data->>conversation_id', 'eq', convId!);
    expect((await unread(owner)).data).toHaveLength(1);
    expect((await unread(staff)).data).toHaveLength(1);
    await staff.client.rpc('mark_conversation_read', { p_conversation_id: convId! });
    expect((await unread(owner)).data).toEqual([]);
  });
});

describe('storage', () => {
  const png = new Blob([new Uint8Array([137, 80, 78, 71])], { type: 'image/png' });

  it('sellers can delete their own photos (so they disappear from the CDN); others cannot', async () => {
    const { listingId } = await createListing(seller, { status: 'draft' });
    const { path, error: upErr } = await uploadViaReservation(
      seller,
      'listing-photos',
      listingId,
      png,
    );
    expect(upErr).toBeNull();
    expect((await buyer.client.storage.from('listing-photos').remove([path!])).data ?? []).toEqual(
      [],
    );
    const { data, error } = await seller.client.storage.from('listing-photos').remove([path!]);
    expect(error).toBeNull();
    expect(data).toHaveLength(1);
  });

  it('upload reservations are rate limited (and the counter sticks)', async () => {
    const u = await createUser('uploader');
    let code: string | undefined;
    for (let i = 0; i < 21 && !code; i++) {
      const { error } = await u.client.rpc('reserve_upload', {
        p_bucket: 'avatars',
        p_target_id: u.id,
        p_content_type: 'image/png',
      });
      code = error?.code;
    }
    expect(code).toBe('CZ429');
  });
});

describe('listing status machine', () => {
  it('sold and removed are final, and nothing goes back to draft', async () => {
    const sold = await createListing(seller);
    await seller.client.from('listings').update({ status: 'sold' }).eq('id', sold.listingId);
    for (const status of ['active', 'draft'] as const) {
      const { error } = await seller.client
        .from('listings')
        .update({ status })
        .eq('id', sold.listingId);
      expect(error?.message).toMatch(/can't go from sold/);
    }
    // ...so the "only drafts / no published listing" delete guards can't be dodged.
    expect(
      (await seller.client.from('vehicles').delete().eq('id', sold.vehicleId).select()).data,
    ).toEqual([]);

    const live = await createListing(seller);
    expect(
      (await seller.client.from('listings').update({ status: 'draft' }).eq('id', live.listingId))
        .error,
    ).not.toBeNull();
  });

  it('admin takedowns are final and admins cannot rewrite listings', async () => {
    const appAdmin = await createUser('mod');
    await admin.from('profiles').update({ role: 'admin' }).eq('id', appAdmin.id);
    const { listingId } = await createListing(seller);

    const rewrite = await appAdmin.client
      .from('listings')
      .update({ price_cents: 100 })
      .eq('id', listingId)
      .select();
    expect(rewrite.data).toEqual([]);

    expect(
      (await appAdmin.client.rpc('admin_remove_listing', { p_listing_id: listingId })).error,
    ).toBeNull();
    const undo = await seller.client
      .from('listings')
      .update({ status: 'active' })
      .eq('id', listingId);
    expect(undo.error).not.toBeNull();
    expect(
      (await seller.client.from('listings').delete().eq('id', listingId).select()).data,
    ).toEqual([]);

    expect(
      (await seller.client.rpc('admin_remove_listing', { p_listing_id: listingId })).error?.code,
    ).toBe('42501');
  });
});

describe('dealership state changes', () => {
  it('email or logo changes also trigger re-verification', async () => {
    const o = await createUser('eowner');
    const id = await createDealership(o);
    await o.client.from('dealerships').update({ email: 'payments@evil.test' }).eq('id', id);
    expect(
      (await admin.from('dealerships').select('verification_status').eq('id', id).single()).data
        ?.verification_status,
    ).toBe('pending');
  });

  it('losing verification cancels open test drives', async () => {
    const o = await createUser('cowner');
    const b = await createUser('cbuyer');
    const id = await createDealership(o);
    const { listingId } = await createListing(o, { dealershipId: id });
    const { data: driveId } = await b.client.rpc('request_test_drive', {
      p_listing_id: listingId,
      p_proposed_times: [new Date(Date.now() + 30 * 3600_000).toISOString()],
    });
    await o.client.from('dealerships').update({ name: 'Renamed Motors' }).eq('id', id); // → pending
    const { data } = await b.client
      .from('test_drive_requests')
      .select('status')
      .eq('id', driveId!)
      .single();
    expect(data?.status).toBe('cancelled');
  });

  it("suspended owners can't manage the team", async () => {
    const o = await createUser('mowner');
    const s = await createUser('mstaff');
    const id = await createDealership(o);
    await addMember(id, s, 'staff');
    await setStatus(id, 'suspended');
    const { data } = await o.client
      .from('dealership_members')
      .update({ role: 'admin' })
      .eq('dealership_id', id)
      .eq('user_id', s.id)
      .select();
    expect(data).toEqual([]);
  });

  it("an inviter's open invitations are deleted with their account", async () => {
    const leaving = await createUser('gone');
    await addMember(dealerId, leaving, 'admin');
    await leaving.client.rpc('create_dealership_invitation', {
      p_dealership_id: dealerId,
      p_email: `accomplice-${randomUUID().slice(0, 6)}@rls.test`,
      p_role: 'admin',
    });
    await admin.auth.admin.deleteUser(leaving.id);
    const { data } = await admin
      .from('dealership_invitations')
      .select('id')
      .is('invited_by', null)
      .is('accepted_at', null);
    expect(data).toEqual([]);
  });
});
