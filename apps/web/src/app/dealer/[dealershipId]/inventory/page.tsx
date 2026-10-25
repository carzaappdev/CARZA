import type { Metadata } from 'next';
import Link from 'next/link';
import { CarFrontIcon, PlusIcon, UploadIcon } from 'lucide-react';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Inventory' };

// Placeholder: the shell is real, the feature lands in its own PR.
export default async function InventoryPage({
  params,
}: {
  params: Promise<{ dealershipId: string }>;
}) {
  const { dealershipId } = await params;
  return (
    <>
      <PageHeader
        title="Inventory"
        description="Every car on your lot."
        action={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/dealer/${dealershipId}/inventory/import`}>
                <UploadIcon /> Import CSV
              </Link>
            </Button>
            <Button asChild>
              <Link href={`/dealer/${dealershipId}/inventory/new`}>
                <PlusIcon /> Add a car
              </Link>
            </Button>
          </div>
        }
      />
      <EmptyState
        Icon={CarFrontIcon}
        title="No inventory yet"
        body="Add cars one at a time or import a CSV."
      />
    </>
  );
}
