import type { Metadata } from 'next';
import Link from 'next/link';
import { CarFrontIcon, UploadIcon } from 'lucide-react';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { requireDealerMember } from '@/lib/auth';

export const metadata: Metadata = { title: 'Dealer dashboard' };

// Placeholder dashboard. The layout already checked membership; pages re-check because layouts and
// pages render in parallel and a page must never rely on its layout for authorization.
export default async function DealerDashboardPage({
  params,
}: {
  params: Promise<{ dealershipId: string }>;
}) {
  const { dealershipId } = await params;
  const { dealership, role } = await requireDealerMember(dealershipId);
  return (
    <>
      <PageHeader
        title={dealership.name}
        action={
          <div className="flex gap-2">
            <Badge variant="outline" className="capitalize">
              {role}
            </Badge>
            <Badge
              variant={dealership.verification_status === 'verified' ? 'default' : 'warning'}
              className="capitalize"
            >
              {dealership.verification_status}
            </Badge>
          </div>
        }
      />
      <EmptyState
        Icon={CarFrontIcon}
        title="Add your first car"
        body="Leads, test drive requests and inventory stats show up here once you have cars listed."
        action={
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button asChild>
              <Link href={`/dealer/${dealership.id}/inventory/new`}>Add a car</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/dealer/${dealership.id}/inventory/import`}>
                <UploadIcon /> Import CSV
              </Link>
            </Button>
          </div>
        }
      />
    </>
  );
}
