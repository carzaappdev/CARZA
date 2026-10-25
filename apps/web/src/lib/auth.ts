import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { DEALER_ROLES, safeNextPath, type DealerRole } from '@carza/shared';
import { createClient } from '@/lib/supabase/server';

/**
 * The signed-in user for this request, verified with the Auth server (getUser, not getSession).
 * Cached per request, so layouts and pages can all call it.
 */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
});

/** For pages/layouts: the user, or a redirect to sign-in that returns here afterwards. */
export async function requireUser(returnTo = '/') {
  const user = await getUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(safeNextPath(returnTo))}`);
  return user;
}

const uuid = z.uuid();

/**
 * For dealer pages/layouts: the user must be a member of `dealershipId` with at least `minRole`.
 * Non-members get a 404 (we don't reveal which dealership ids exist). RLS enforces the same rule on data.
 */
export async function requireDealerMember(dealershipId: string, minRole: DealerRole = 'staff') {
  const user = await requireUser(`/dealer/${dealershipId}`);
  if (!uuid.safeParse(dealershipId).success) notFound();

  const supabase = await createClient();
  const { data } = await supabase
    .from('dealership_members')
    .select('role, dealerships ( id, name, slug, verification_status, timezone )')
    .eq('dealership_id', dealershipId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!data?.dealerships || DEALER_ROLES.indexOf(data.role) < DEALER_ROLES.indexOf(minRole))
    notFound();
  return { user, role: data.role, dealership: data.dealerships };
}

/** For admin-only pages. Non-admins get a 404. */
export async function requireAdmin() {
  const user = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).single();
  if (data?.role !== 'admin') notFound();
  return user;
}
