import type { Metadata } from 'next';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
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
  const { data: home } = await supabase
    .from('profile_private')
    .select('postal_code, onboarded_at, birth_date')
    .eq('user_id', user.id)
    .maybeSingle();
  if (home && !home.birth_date) redirect('/age');
  // Setup is a one-time thing: once it's done (or skipped through), go to the feed.
  if (home?.onboarded_at) redirect('/');
  // Came from an invite link: follow whoever sent it (only works once, in an account's first week).
  const ref = (await cookies()).get(INVITE_COOKIE)?.value;
  if (ref && validUsername(ref)) await supabase.rpc('accept_invite', { p_username: ref });
  const [garage, catalog] = await Promise.all([getGarage(supabase, user.id), getCatalog()]);
  return <WelcomeFlow garage={garage} catalog={catalog} postalCode={home?.postal_code ?? ''} />;
}
