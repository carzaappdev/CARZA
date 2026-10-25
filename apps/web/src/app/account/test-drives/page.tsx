import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarClockIcon } from 'lucide-react';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { SEARCH_HREF } from '@/components/layout/nav';

export const metadata: Metadata = { title: 'Test drives' };

// Placeholder: the shell is real, the feature lands in its own PR.
export default function TestdrivesPage() {
  return (
    <>
      <PageHeader title="Test drives" description="Test drives you’ve requested." />
      <EmptyState
        Icon={CalendarClockIcon}
        title="No test drives yet"
        body="Request one from any dealer listing."
        action={
          <Button asChild>
            <Link href={SEARCH_HREF}>Browse cars</Link>
          </Button>
        }
      />
    </>
  );
}
