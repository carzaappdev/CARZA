import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { signOut } from '../auth/actions';

export const metadata: Metadata = { title: 'Your account' };

// Placeholder until the app-shell stage builds the real account area.
export default async function AccountPage() {
  const user = await requireUser('/account');
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, username')
    .eq('id', user.id)
    .maybeSingle();
  if (!profile) throw new Error('Profile missing for signed-in user');

  return (
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold">Your account</h1>
      <p>
        Signed in as <strong>{profile.display_name}</strong> (@{profile.username})
      </p>
      <form action={signOut}>
        <button type="submit" className="border-input h-10 rounded-md border px-4 font-medium">
          Sign out
        </button>
      </form>
    </main>
  );
}
