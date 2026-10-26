import type { Metadata } from 'next';
import { MessageSquareIcon } from 'lucide-react';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'Leads' };

// Placeholder: the shell is real, the feature lands in its own PR.
export default function LeadsPage() {
  return (
    <>
      <PageHeader title="Leads" description="Buyers who messaged your dealership." />
      <EmptyState
        Icon={MessageSquareIcon}
        title="No leads yet"
        body="When buyers message you about a car, their conversations show up here."
      />
    </>
  );
}
