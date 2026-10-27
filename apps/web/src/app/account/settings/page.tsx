import type { Metadata } from 'next';
import { PageHeader } from '@/components/layout/page-header';
import { ProfileForm } from '@/components/feed/profile-form';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Edit profile' };

export default async function SettingsPage() {
  const user = await requireUser('/account/settings');
  const supabase = await createClient();
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, username, bio, avatar_path')
    .eq('id', user.id)
    .single();
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
    </>
  );
}
