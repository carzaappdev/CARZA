import 'server-only';
import { cache } from 'react';
import { notFound, redirect } from 'next/navigation';
import { z } from 'zod';
import { meetsDealerRole, safeNextPath, type DealerRole } from '@carza/shared';
import { createClient } from '@/lib/supabase/server';

// Two layers:
// * Lookups (getUser, getDealerMembership, isAdmin) return data or null and never navigate.
//   Server Actions use these (the action() wrapper maps null → UNAUTHENTICATED / FORBIDDEN).
// * require* helpers are for pages/layouts: they redirect to sign-in or render a 404.
// RLS enforces the same rules on the data either way.

/** The signed-in user, verified with the Auth server (getUser, not getSession). Cached per request. */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  return error ? null : data.user;
});

const uuid = z.uuid();

/** The current user's membership in `dealershipId` if they have at least `minRole`, else null. */
export async function getDealerMembership(dealershipId: string, minRole: DealerRole = 'staff') {
  const user = await getUser();
  if (!user || !uuid.safeParse(dealershipId).success) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from('dealership_members')
    .select('role, dealerships ( id, name, slug, verification_status, timezone )')
    .eq('dealership_id', dealershipId)
    .eq('user_id', user.id)
    .maybeSingle();

  if (!data?.dealerships || !meetsDealerRole(data.role, minRole)) return null;
  return { user, role: data.role, dealership: data.dealerships };
}

/** Whether the current user is an app admin. */
export async function isAdmin() {
  const user = await getUser();
  if (!user) return false;
  const supabase = await createClient();
  const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
  return data?.role === 'admin';
}

/**
 * True if this session was created from an email link (recovery or confirmation, both recorded by Supabase
 * as `otp`) in the last 10 minutes, i.e. the user just proved they control the email address.
 * Password changes require it, so a stolen or unattended session can't silently lock the owner out.
 */
export async function hasRecentRecoverySession() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const amr = (data?.claims?.amr ?? []) as { method: string; timestamp: number }[];
  const tenMinutesAgo = Date.now() / 1000 - 600;
  return amr.some(
    (a) => (a.method === 'otp' || a.method === 'recovery') && a.timestamp >= tenMinutesAgo,
  );
}

/** Pages/layouts: the user, or a redirect to sign-in that returns to `returnTo` afterwards. */
export async function requireUser(returnTo = '/') {
  const user = await getUser();
  if (!user) redirect(`/sign-in?next=${encodeURIComponent(safeNextPath(returnTo))}`);
  return user;
}

/** Dealer pages/layouts: members with at least `minRole`. Others get a 404 (ids aren't confirmed). */
export async function requireDealerMember(dealershipId: string, minRole: DealerRole = 'staff') {
  await requireUser(`/dealer/${dealershipId}`);
  const membership = await getDealerMembership(dealershipId, minRole);
  if (!membership) notFound();
  return membership;
}

/** Admin-only pages. Non-admins get a 404. */
export async function requireAdmin(returnTo = '/') {
  const user = await requireUser(returnTo);
  if (!(await isAdmin())) notFound();
  return user;
}
