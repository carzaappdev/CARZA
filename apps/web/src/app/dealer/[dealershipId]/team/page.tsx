import type { Metadata } from 'next';
import { UsersIcon } from 'lucide-react';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'Team' };

// Placeholder: the shell is real, the feature lands in its own PR.
export default function TeamPage() {
  return (
    <>
      <PageHeader title="Team" description="People who can manage this dealership." />
      <EmptyState
        Icon={UsersIcon}
        title="Team management is coming"
        body="You’ll invite staff and set their roles here."
      />
    </>
  );
}
