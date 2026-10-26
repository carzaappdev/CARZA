'use server';

import type { Route } from 'next';
import { redirect } from 'next/navigation';
import { emailOtpTypeSchema, safeNextPath } from '@carza/shared';
import { createClient } from '@/lib/supabase/server';

/** Signs out THIS device only. ("Sign out everywhere" can be added in settings with scope: 'global'.) */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: 'local' });
  redirect('/');
}

/**
 * Consumes an email link (confirm sign-up, password recovery, email change). Runs only from the
 * "Continue" button (a same-origin POST, Origin-checked by Next): a plain GET of the link never signs
 * anyone in. That blocks login CSRF (an attacker mailing you THEIR link) and email scanners burning tokens.
 */
export async function confirmEmailLink(formData: FormData) {
  const tokenHash = formData.get('token_hash');
  const type = emailOtpTypeSchema.safeParse(formData.get('type'));
  const nextRaw = formData.get('next');
  const next = safeNextPath(
    typeof nextRaw === 'string' ? nextRaw : null,
    type.data === 'recovery' ? '/update-password' : '/',
  );

  if (typeof tokenHash === 'string' && tokenHash && type.success) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type: type.data, token_hash: tokenHash });
    // `next` is a validated same-origin path (safeNextPath).
    if (!error) redirect(next as Route);
  }
  redirect('/sign-in?error=link_invalid');
}
