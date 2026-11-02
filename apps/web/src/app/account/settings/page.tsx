import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { mutedPushCategories } from '@carza/shared';
import { ProfileForm } from '@/components/feed/profile-form';
import { PushSettings } from '@/components/pwa/push-settings';
import { BlockedList } from '@/components/safety/blocked-list';
import { ThemePicker } from '@/components/theme/theme-toggle';
import { requireUser } from '@/lib/auth';
import { vapidPublicKey } from '@/lib/push';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Edit profile' };

export default async function SettingsPage() {
  const user = await requireUser('/account/settings');
  const supabase = await createClient();
  const [{ data: profile }, { data: blocks }, { data: privateProfile }, publicKey] =
    await Promise.all([
      supabase
        .from('profiles')
        .select('display_name, username, bio, avatar_path')
        .eq('id', user.id)
        .single(),
      supabase
        .from('blocks')
        .select(
          'profile:profiles!blocks_blocked_id_fkey ( id, username, display_name, avatar_path )',
        )
        .eq('blocker_id', user.id)
        .order('created_at', { ascending: false }),
      supabase.from('profile_private').select('push_muted').eq('user_id', user.id).maybeSingle(),
      vapidPublicKey(),
    ]);
  return (
    <>
      <PageHeader title="Edit profile" description="This is how people see you on Carza." />
      <ProfileForm
        initial={{
          displayName: profile?.display_name ?? '',
          username: profile?.username ?? '',
          bio: profile?.bio ?? '',
          avatarPath: profile?.avatar_path ?? null,
        }}
      />
      <section aria-labelledby="alerts-heading" className="flex flex-col gap-3 border-t pt-6">
        <h2 id="alerts-heading" className="font-semibold">
          Notifications
        </h2>
        <PushSettings
          publicKey={publicKey}
          initialMuted={mutedPushCategories(privateProfile?.push_muted ?? [])}
        />
      </section>
      <section aria-label="Display" className="border-t pt-6">
        <ThemePicker />
      </section>
      <section aria-labelledby="blocked-heading" className="flex flex-col gap-3 border-t pt-6">
        <h2 id="blocked-heading" className="font-semibold">
          Blocked accounts
        </h2>
        <BlockedList initial={(blocks ?? []).flatMap((b) => (b.profile ? [b.profile] : []))} />
      </section>
    </>
  );
}
