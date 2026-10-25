import type { Metadata } from 'next';
import { CarFrontIcon } from 'lucide-react';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'Inventory' };

// Placeholder: the shell is real, the feature lands in its own PR.
export default function InventoryPage() {
  return (
    <>
      <PageHeader title="Inventory" description="Every car on your lot." />
      <EmptyState
        Icon={CarFrontIcon}
        title="No inventory yet"
        body="Add cars one at a time or import a CSV."
      />
    </>
  );
}
