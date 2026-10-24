import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { addMember, anon, cleanup, createDealership, createUser, type TestUser } from './helpers';

let owner: TestUser;
let staff: TestUser;
let dealerAdmin: TestUser;
let outsider: TestUser;
let pendingOwner: TestUser;
let verifiedId: string;
let pendingId: string;

beforeAll(async () => {
  [owner, staff, dealerAdmin, outsider, pendingOwner] = await Promise.all([
    createUser('owner'),
    createUser('staff'),
    createUser('dadmin'),
    createUser('outsider'),
    createUser('pending'),
  ]);
  verifiedId = await createDealership(owner);
  pendingId = await createDealership(pendingOwner, { verified: false });
  await addMember(verifiedId, staff, 'staff');
  await addMember(verifiedId, dealerAdmin, 'admin');
});
afterAll(cleanup);

describe('dealerships', () => {
  it('verified ones are public; pending ones are hidden from the public', async () => {
    const { data } = await anon()
      .from('dealerships')
      .select('id')
      .in('id', [verifiedId, pendingId]);
    expect(data?.map((d) => d.id)).toEqual([verifiedId]);
  });

  it('pending ones are visible to their own members', async () => {
    const { data } = await pendingOwner.client.from('dealerships').select('id').eq('id', pendingId);
    expect(data).toHaveLength(1);
  });

  it('staff cannot edit the dealership; admins can', async () => {
    const asStaff = await staff.client
      .from('dealerships')
      .update({ name: 'Nope' })
      .eq('id', verifiedId)
      .select();
    expect(asStaff.data).toEqual([]);
    const asAdmin = await dealerAdmin.client
      .from('dealerships')
      .update({ name: 'New Name' })
      .eq('id', verifiedId)
      .select();
    expect(asAdmin.data).toHaveLength(1);
  });

  it('nobody can self-verify', async () => {
    const direct = await pendingOwner.client
      .from('dealerships')
      .update({ verification_status: 'verified' })
      .eq('id', pendingId);
    expect(direct.error?.code).toBe('42501');
    const rpc = await pendingOwner.client.rpc('set_dealership_verification', {
      p_dealership_id: pendingId,
      p_status: 'verified',
    });
    expect(rpc.error?.code).toBe('42501');
  });

  it('cannot be inserted directly (only via apply_for_dealership)', async () => {
    const { error } = await outsider.client.from('dealerships').insert({
      slug: 'sneaky',
      name: 'Sneaky',
      address_line1: 'x',
      city: 'x',
      region: 'x',
      postal_code: '00000',
      location: 'SRID=4326;POINT(0 0)',
      timezone: 'UTC',
    });
    expect(error?.code).toBe('42501');
  });

  it('allows only one pending application per user', async () => {
    const { error } = await pendingOwner.client.rpc('apply_for_dealership', {
      p_name: 'Second Try',
      p_address_line1: '1 Main',
      p_city: 'X',
      p_region: 'TX',
      p_postal_code: '78701',
      p_lat: 30,
      p_lng: -97,
      p_timezone: 'America/Chicago',
    });
    expect(error?.message).toMatch(/pending/);
  });
});

describe('dealership_members', () => {
  it('outsiders cannot see the team', async () => {
    const { data } = await outsider.client
      .from('dealership_members')
      .select('*')
      .eq('dealership_id', verifiedId);
    expect(data).toEqual([]);
  });

  it('staff cannot remove the owner', async () => {
    const { data } = await staff.client
      .from('dealership_members')
      .delete()
      .eq('dealership_id', verifiedId)
      .eq('user_id', owner.id)
      .select();
    expect(data).toEqual([]);
  });

  it('admins cannot promote anyone to owner', async () => {
    const { error } = await dealerAdmin.client
      .from('dealership_members')
      .update({ role: 'owner' })
      .eq('dealership_id', verifiedId)
      .eq('user_id', staff.id);
    expect(error?.code).toBe('42501');
  });

  it('the last owner cannot leave', async () => {
    const { error } = await owner.client
      .from('dealership_members')
      .delete()
      .eq('dealership_id', verifiedId)
      .eq('user_id', owner.id);
    expect(error?.message).toMatch(/at least one owner/);
  });
});

describe('dealership_invitations', () => {
  it('invites can only be accepted by the invited email', async () => {
    const invitee = await createUser('invitee');
    const { data: token, error } = await dealerAdmin.client.rpc('create_dealership_invitation', {
      p_dealership_id: verifiedId,
      p_email: invitee.email,
      p_role: 'staff',
    });
    expect(error).toBeNull();

    const wrong = await outsider.client.rpc('accept_dealership_invitation', { p_token: token! });
    expect(wrong.error?.message).toMatch(/invalid or has expired/);

    const right = await invitee.client.rpc('accept_dealership_invitation', { p_token: token! });
    expect(right.data).toBe(verifiedId);

    const reuse = await invitee.client.rpc('accept_dealership_invitation', { p_token: token! });
    expect(reuse.error).not.toBeNull();
  });

  it('staff cannot invite', async () => {
    const { error } = await staff.client.rpc('create_dealership_invitation', {
      p_dealership_id: verifiedId,
      p_email: 'x@rls.test',
      p_role: 'staff',
    });
    expect(error?.code).toBe('42501');
  });

  it('invitation tokens are never readable', async () => {
    const { data } = await dealerAdmin.client
      .from('dealership_invitations')
      .select('token_hash')
      .eq('dealership_id', verifiedId);
    // Admins see the hash only, never the token; the token is returned once by create_dealership_invitation.
    for (const row of data ?? []) expect(row.token_hash).toMatch(/^[0-9a-f]{64}$/);
    const asOutsider = await outsider.client
      .from('dealership_invitations')
      .select('*')
      .eq('dealership_id', verifiedId);
    expect(asOutsider.data).toEqual([]);
  });
});
