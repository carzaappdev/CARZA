import type { Metadata } from 'next';
import Link from 'next/link';
import { CarFrontIcon } from 'lucide-react';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';

export const metadata: Metadata = { title: 'Your listings' };

// Placeholder: the shell is real, the feature lands in its own PR.
export default function YourlistingsPage() {
  return (
    <>
      <PageHeader title="Your listings" description="Cars you’re selling privately." />
      <EmptyState
        Icon={CarFrontIcon}
        title="No listings yet"
        body="List your car in a few minutes and reach local buyers."
        action={
          <Button asChild>
            <Link href="/account/listings/new">List your car</Link>
          </Button>
        }
      />
    </>
  );
}
