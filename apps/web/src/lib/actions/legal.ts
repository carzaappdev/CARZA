'use server';

import { revalidatePath } from 'next/cache';
import {
  fail,
  legalRequestSchema,
  ok,
  resolveLegalRequestSchema,
  type ActionResult,
} from '@carza/shared';
import { getUser, isAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/**
 * Files a legal request (intimate image removal, copyright, privacy, other). Deliberately open to people
 * without an account: the law requires a way for anyone to ask. The database rate-limits it and nobody
 * but admins can read what's submitted.
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
  const { kind, name, email, urls, statement, signature } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('submit_legal_request', {
    p_kind: kind,
    p_name: name,
    p_email: email,
    p_urls: urls,
    p_statement: statement,
    p_signature: signature,
  });
  if (error || !data) {
    if (error?.code === 'CZ429')
      return fail('RATE_LIMITED', 'We’ve had a lot of requests. Please try again in an hour.');
    console.error('submitLegalRequest failed', { code: error?.code, kind });
    return fail('INTERNAL', 'Couldn’t send your request. Please try again.');
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
