import type { Metadata } from 'next';
import { StoreIcon } from 'lucide-react';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'Dealer' };

// Placeholder: the shell is real, the feature lands in its own PR.
export default function DealerPage() {
  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-8 sm:px-6">
      <PageHeader title="Dealer" />
      <EmptyState
        Icon={StoreIcon}
        title="Dealer pages are coming"
        body="A dealer's profile and their full inventory will live here."
      />
    </div>
  );
}
