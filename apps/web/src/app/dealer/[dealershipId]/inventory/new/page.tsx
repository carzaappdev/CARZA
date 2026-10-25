import type { Metadata } from 'next';
import { PlusCircleIcon } from 'lucide-react';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'Add a car' };

// Placeholder: the shell is real, the feature lands in its own PR.
export default function AddacarPage() {
  return (
    <>
      <PageHeader title="Add a car" />
      <EmptyState
        Icon={PlusCircleIcon}
        title="The listing form is coming"
        body="You’ll add photos, details and price here."
      />
    </>
  );
}
