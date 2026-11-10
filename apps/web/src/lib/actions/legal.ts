'use server';

import { createHmac } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import {
  fail,
  legalRequestSchema,
  ok,
  resolveLegalRequestSchema,
  type ActionResult,
} from '@carza/shared';
import { CONTACT_EMAIL } from '@/components/legal/legal';
import { serverEnv } from '@/env/server';
import { getUser, isAdmin } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/** A keyed hash of the caller's network address: enough to limit one sender, useless for anything else. */
async function senderHash(key: string) {
  const h = await headers();
  // Vercel sets these itself; a client can't forge them.
  const ip =
    h.get('x-vercel-forwarded-for') ?? h.get('x-real-ip') ?? h.get('x-forwarded-for') ?? 'unknown';
  return createHmac('sha256', key)
    .update(ip.split(',')[0]?.trim() || 'unknown')
    .digest('hex');
}

const FALLBACK = CONTACT_EMAIL ? ` You can also email ${CONTACT_EMAIL}.` : '';

/**
 * Files a legal request (intimate image removal, copyright, privacy, other). Deliberately open to people
 * without an account: the law requires a way for anyone to ask. It goes in with the secret key because
 * the limit is per sender address, which only the server knows; nobody but admins can read what's sent.
 */
export async function submitLegalRequest(
  input: unknown,
): Promise<ActionResult<{ ticket: string }>> {
  const parsed = legalRequestSchema.safeParse(input);
  if (!parsed.success) {
    return fail(
      'VALIDATION',
      'Check the highlighted fields.',
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }
  const admin = createAdminClient();
  const key = serverEnv.SUPABASE_SECRET_KEY;
  if (!admin || !key) {
    console.error('submitLegalRequest: no secret key configured');
    return fail('INTERNAL', `We couldn’t take your request here right now.${FALLBACK}`);
  }
  // Recorded when the sender happens to be signed in; never required.
  const user = await getUser();
  const { kind, name, email, urls, statement, signature } = parsed.data;
  const { data, error } = await admin.rpc('submit_legal_request', {
    p_kind: kind,
    p_name: name,
    p_email: email,
    p_urls: urls,
    p_statement: statement,
    p_signature: signature,
    p_sender_hash: await senderHash(key),
    ...(user ? { p_user_id: user.id } : {}),
  });
  if (error || !data) {
    if (error?.code === 'CZ429')
      return fail(
        'RATE_LIMITED',
        `You’ve sent several requests in the last hour. We have them. Please wait before sending more.${FALLBACK}`,
      );
    console.error('submitLegalRequest failed', { code: error?.code, kind });
    return fail('INTERNAL', `Couldn’t send your request. Please try again.${FALLBACK}`);
  }
  return ok({ ticket: data });
}

/** Admins only: mark a legal request done or rejected. */
export async function resolveLegalRequest(input: unknown): Promise<ActionResult<null>> {
  const parsed = resolveLegalRequestSchema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION', 'That request wasn’t valid.');
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in first.');
  if (!(await isAdmin())) return fail('FORBIDDEN', 'Only admins can do that.');
  const { data, error } = await (
    await createClient()
  )
    .from('legal_requests')
    .update({ status: parsed.data.status })
    .eq('id', parsed.data.requestId)
    .select('id');
  if (error || !data.length) {
    console.error('resolveLegalRequest failed', { code: error?.code, userId: user.id });
    return fail('INTERNAL', 'Couldn’t update the request. Try again.');
  }
  revalidatePath('/account/reports');
  return ok(null);
}
