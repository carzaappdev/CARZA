import type { Metadata } from 'next';
import { SettingsIcon } from 'lucide-react';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'Settings' };

// Placeholder: the shell is real, the feature lands in its own PR.
export default function SettingsPage() {
  return (
    <>
      <PageHeader title="Settings" description="Your dealership’s public profile." />
      <EmptyState
        Icon={SettingsIcon}
        title="Settings are coming"
        body="You’ll edit your address, hours, logo and contact details here."
      />
    </>
  );
}
