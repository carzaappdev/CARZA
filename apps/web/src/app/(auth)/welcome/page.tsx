import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { getGarage } from '@carza/db';
import { WelcomeFlow } from '@/components/onboarding/welcome-flow';
import { requireUser } from '@/lib/auth';
import { getCatalog } from '@/lib/catalog';
import { INVITE_COOKIE, validUsername } from '@/lib/invites';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Welcome' };

/** First-run setup: where you drive, what you drive, who to follow. Every step can be skipped. */
export default async function WelcomePage() {
  const user = await requireUser('/welcome');
  const supabase = await createClient();
  // Came from an invite link: follow whoever sent it (only works once, in an account's first week).
  const ref = (await cookies()).get(INVITE_COOKIE)?.value;
  if (ref && validUsername(ref)) await supabase.rpc('accept_invite', { p_username: ref });
  const [garage, catalog, { data: home }] = await Promise.all([
    getGarage(supabase, user.id),
    getCatalog(),
    supabase.from('profile_private').select('postal_code').eq('user_id', user.id).maybeSingle(),
  ]);
  return <WelcomeFlow garage={garage} catalog={catalog} postalCode={home?.postal_code ?? ''} />;
}
