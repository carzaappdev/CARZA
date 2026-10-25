import type { Metadata } from 'next';
import { UploadIcon } from 'lucide-react';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'Import inventory' };

// Placeholder: the shell is real, the feature lands in its own PR.
export default function ImportinventoryPage() {
  return (
    <>
      <PageHeader title="Import inventory" description="Upload a CSV of your cars." />
      <EmptyState
        Icon={UploadIcon}
        title="CSV import is coming"
        body="You’ll upload a spreadsheet and review cars before they go live."
      />
    </>
  );
}
