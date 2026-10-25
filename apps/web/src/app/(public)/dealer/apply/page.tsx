import type { Metadata } from 'next';
import { StoreIcon } from 'lucide-react';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'Become a dealer' };

// Placeholder: the shell is real, the feature lands in its own PR.
export default function BecomeadealerPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6">
      <PageHeader title="Become a dealer" description="List your inventory on Carza." />
      <EmptyState
        Icon={StoreIcon}
        title="Applications open soon"
        body="You’ll enter your business details here and can start setting up right away."
      />
    </div>
  );
}
