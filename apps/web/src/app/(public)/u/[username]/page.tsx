import type { Metadata } from 'next';
import { UserIcon } from 'lucide-react';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'Profile' };

// Placeholder: the shell is real, the feature lands in its own PR.
export default function ProfilePage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6">
      <PageHeader title="Profile" />
      <EmptyState
        Icon={UserIcon}
        title="Profiles are coming"
        body="A seller’s public profile and active listings will live here."
      />
    </div>
  );
}
