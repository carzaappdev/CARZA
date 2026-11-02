import type { Metadata } from 'next';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { DownloadIcon, KeyRoundIcon, LogOutIcon } from 'lucide-react';
import { DeleteAccount } from '@/components/account/delete-account';
import { PageHeader } from '@/components/layout/page-header';
import { ProfileForm } from '@/components/feed/profile-form';
import { BlockedList } from '@/components/safety/blocked-list';
import { ThemePicker } from '@/components/theme/theme-toggle';
import { Button } from '@/components/ui/button';
import { signOut } from '@/app/auth/actions';
import { signOutEverywhere } from '@/lib/actions/account';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Settings' };

export default async function SettingsPage() {
  const user = await requireUser('/account/settings');
  const supabase = await createClient();
  const [{ data: profile }, { data: blocks }] = await Promise.all([
    supabase
      .from('profiles')
      .select('display_name, username, bio, avatar_path')
      .eq('id', user.id)
      .single(),
    supabase
      .from('blocks')
      .select('profile:profiles!blocks_blocked_id_fkey ( id, username, display_name, avatar_path )')
      .eq('blocker_id', user.id)
      .order('created_at', { ascending: false }),
  ]);
  const providers = (user.app_metadata.providers as string[] | undefined) ?? [];
  const hasPassword = providers.includes('email');

  return (
    <>
      <PageHeader title="Settings" description="Your profile, account and privacy." />
      <Section id="profile" title="Profile">
        <ProfileForm
          initial={{
            displayName: profile?.display_name ?? '',
            username: profile?.username ?? '',
            bio: profile?.bio ?? '',
            avatarPath: profile?.avatar_path ?? null,
          }}
        />
      </Section>

      <Section id="display" title="Display">
        <ThemePicker />
      </Section>

      <Section id="account" title="Account">
        <dl className="grid gap-1 text-[15px]">
          <dt className="text-muted-foreground text-sm">Email</dt>
          <dd className="truncate">{user.email}</dd>
          {providers.some((p) => p !== 'email') ? (
            <>
              <dt className="text-muted-foreground mt-2 text-sm">Signed in with</dt>
              <dd className="capitalize">{providers.filter((p) => p !== 'email').join(', ')}</dd>
            </>
          ) : null}
        </dl>
        <div className="flex flex-wrap gap-2">
          {hasPassword ? (
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/reset-password">
                <KeyRoundIcon aria-hidden /> Change password
              </Link>
            </Button>
          ) : null}
          <form action={signOut}>
            <Button type="submit" variant="outline" className="rounded-xl">
              <LogOutIcon aria-hidden /> Sign out
            </Button>
          </form>
          <form action={signOutEverywhere}>
            <Button type="submit" variant="ghost" className="rounded-xl">
              Sign out of all devices
            </Button>
          </form>
        </div>
      </Section>

      <Section id="blocked" title="Blocked accounts">
        <p className="text-muted-foreground -mt-1 text-sm">
          You and the people you block won’t see each other’s posts, reels or events.
        </p>
        <BlockedList initial={(blocks ?? []).flatMap((b) => (b.profile ? [b.profile] : []))} />
      </Section>

      <Section id="data" title="Your data">
        <p className="text-muted-foreground -mt-1 text-sm">
          Download a copy of your profile, posts, reels, events, follows and garage as a JSON file.
        </p>
        <Button asChild variant="outline" className="self-start rounded-xl">
          {/* A plain link: the route answers with a file download. */}
          <a href="/account/export" download>
            <DownloadIcon aria-hidden /> Download your data
          </a>
        </Button>
      </Section>

      <Section id="delete" title="Delete account">
        <p className="text-muted-foreground -mt-1 text-sm">
          Permanently delete your account and everything you’ve shared on Carza.
        </p>
        <DeleteAccount username={profile?.username ?? ''} />
      </Section>
    </>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-3 border-t pt-6">
      <h2 id={`${id}-heading`} className="font-display text-lg font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}
