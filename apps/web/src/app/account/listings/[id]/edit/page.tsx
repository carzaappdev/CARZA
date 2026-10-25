import type { Metadata } from 'next';
import { PencilIcon } from 'lucide-react';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'Edit listing' };

// Placeholder: the shell is real, the feature lands in its own PR.
export default function EditlistingPage() {
  return (
    <>
      <PageHeader title="Edit listing" />
      <EmptyState
        Icon={PencilIcon}
        title="Editing is coming"
        body="You’ll update photos, details and price here."
      />
    </>
  );
}
