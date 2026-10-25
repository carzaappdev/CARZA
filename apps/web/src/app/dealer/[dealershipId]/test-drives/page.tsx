import type { Metadata } from 'next';
import { CalendarClockIcon } from 'lucide-react';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'Test drives' };

// Placeholder: the shell is real, the feature lands in its own PR.
export default function TestdrivesPage() {
  return (
    <>
      <PageHeader title="Test drives" description="Requests from buyers." />
      <EmptyState
        Icon={CalendarClockIcon}
        title="No test drive requests"
        body="Requests for your cars show up here for you to confirm."
      />
    </>
  );
}
