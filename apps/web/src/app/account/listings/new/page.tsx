import type { Metadata } from 'next';
import { PlusCircleIcon } from 'lucide-react';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'Sell your car' };

// Placeholder: the shell is real, the feature lands in its own PR.
export default function SellyourcarPage() {
  return (
    <>
      <PageHeader title="Sell your car" description="Create a private-party listing." />
      <EmptyState
        Icon={PlusCircleIcon}
        title="The listing form is coming"
        body="You’ll add photos, details and a price here."
      />
    </>
  );
}
