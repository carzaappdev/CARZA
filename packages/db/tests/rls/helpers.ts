import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { inject } from 'vitest';
import type { TypedClient } from '../../src';
import type { Database } from '../../src/database.types';

const url = inject('supabaseUrl');
const publishableKey = inject('publishableKey');
const secretKey = inject('secretKey');

const opts = { auth: { persistSession: false, autoRefreshToken: false } };

/** Bypasses RLS. Only for arranging fixtures and cleanup, never for the assertions themselves. */
export const admin: TypedClient = createClient<Database>(url, secretKey, opts);
export const anon = (): TypedClient => createClient<Database>(url, publishableKey, opts);

export type TestUser = { id: string; email: string; client: TypedClient };

const createdUsers: string[] = [];
const uploadedObjects: { bucket: string; path: string }[] = [];
const createdDealerships: string[] = [];

export async function createUser(label = 'user', email?: string): Promise<TestUser> {
  const address = email ?? `${label}-${randomUUID().slice(0, 8)}@rls.test`;
  const password = `pw-${randomUUID()}`;
  const { data, error } = await admin.auth.admin.createUser({
    email: address,
    password,
    email_confirm: true,
    user_metadata: { display_name: `Test ${label}` },
  });
  if (error || !data.user) throw error ?? new Error('createUser failed');
  createdUsers.push(data.user.id);

  const client = anon();
  const { error: signInError } = await client.auth.signInWithPassword({ email: address, password });
  if (signInError) throw signInError;
  return { id: data.user.id, email: address, client };
}

/** Creates a dealership owned by `owner` through the real RPC, then (optionally) verifies it as admin. */
export async function createDealership(owner: TestUser, { verified = true } = {}) {
  const { data: id, error } = await owner.client.rpc('apply_for_dealership', {
    p_name: `Test Motors ${randomUUID().slice(0, 6)}`,
    p_address_line1: '1 Main St',
    p_city: 'Testville',
    p_region: 'TX',
    p_postal_code: '78701',
    p_lat: 30.27,
    p_lng: -97.74,
    p_timezone: 'America/Chicago',
  });
  if (error || !id) throw error ?? new Error('apply_for_dealership failed');
  createdDealerships.push(id);
  if (verified) {
    const { error: vErr } = await admin
      .from('dealerships')
      .update({ verification_status: 'verified' })
      .eq('id', id);
    if (vErr) throw vErr;
  }
  return id;
}

export async function addMember(
  dealershipId: string,
  user: TestUser,
  role: 'staff' | 'admin' | 'owner',
) {
  const { error } = await admin
    .from('dealership_members')
    .insert({ dealership_id: dealershipId, user_id: user.id, role });
  if (error) throw error;
}

export async function catalogIds() {
  const { data, error } = await admin
    .from('vehicle_models')
    .select('id, make_id')
    .limit(1)
    .single();
  if (error) throw error;
  return { makeId: data.make_id, modelId: data.id };
}

const POINT = 'SRID=4326;POINT(-97.74 30.27)';

/** Creates a vehicle + listing as `seller` (a user, or a dealership member acting for `dealershipId`). */
export async function createListing(
  seller: TestUser,
  {
    dealershipId,
    status = 'active',
  }: { dealershipId?: string; status?: Database['public']['Enums']['listing_status'] } = {},
) {
  const { makeId, modelId } = await catalogIds();
  const owner = dealershipId ? { owner_dealership_id: dealershipId } : { owner_user_id: seller.id };
  const { data: vehicle, error: vErr } = await seller.client
    .from('vehicles')
    .insert({ ...owner, year: 2020, make_id: makeId, model_id: modelId, mileage: 42000 })
    .select('id')
    .single();
  if (vErr) throw vErr;

  const sellerCols = dealershipId
    ? { seller_dealership_id: dealershipId }
    : { seller_user_id: seller.id };
  const { data: listing, error: lErr } = await seller.client
    .from('listings')
    .insert({
      ...sellerCols,
      vehicle_id: vehicle.id,
      status,
      price_cents: 1_500_000,
      location: POINT,
      city: 'Testville',
      region: 'TX',
    })
    .select('id')
    .single();
  if (lErr) throw lErr;
  return { listingId: listing.id, vehicleId: vehicle.id };
}

export async function cleanup() {
  for (const { bucket, path } of uploadedObjects.splice(0))
    await admin.storage.from(bucket).remove([path]);
  // Dealerships first: the "keep one owner" guard blocks deleting a user who is a dealership's last owner.
  if (createdDealerships.length)
    await admin.from('dealerships').delete().in('id', createdDealerships.splice(0));
  for (const id of createdUsers.splice(0)) await admin.auth.admin.deleteUser(id);
}

/**
 * The real upload flow: reserve a path (permission + rate limit, as the user), have the SERVER sign an
 * upload URL for exactly that path (secret key), then upload from the client with the token.
 */
export async function uploadViaReservation(
  user: TestUser,
  bucket: 'listing-photos' | 'avatars' | 'dealership-logos',
  targetId: string,
  file: Blob,
) {
  const { data: path, error } = await user.client.rpc('reserve_upload', {
    p_bucket: bucket,
    p_target_id: targetId,
    p_content_type: file.type,
  });
  if (error || !path) return { path: null, error: error ?? new Error('no path') };
  const signed = await admin.storage.from(bucket).createSignedUploadUrl(path);
  if (signed.error) return { path, error: signed.error };
  const upload = await user.client.storage
    .from(bucket)
    .uploadToSignedUrl(path, signed.data.token, file, { contentType: file.type });
  if (!upload.error) uploadedObjects.push({ bucket, path });
  return { path, error: upload.error };
}
