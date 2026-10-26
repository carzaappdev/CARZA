import type { Metadata } from 'next';
import { SettingsIcon } from 'lucide-react';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'Settings' };

// Placeholder: the shell is real, the feature lands in its own PR.
export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Profile, location and password." />
      <EmptyState
        Icon={SettingsIcon}
        title="Settings are coming"
        body="You’ll edit your profile, location and password here."
      />
    </>
  );
}
