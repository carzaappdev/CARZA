import type { Metadata } from 'next';
import { MessageSquareIcon } from 'lucide-react';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/layout/page-header';

export const metadata: Metadata = { title: 'Lead' };

// Placeholder: the shell is real, the feature lands in its own PR.
export default function LeadPage() {
  return (
    <>
      <PageHeader title="Lead" />
      <EmptyState
        Icon={MessageSquareIcon}
        title="Conversations are coming"
        body="Live messaging lands with the messaging feature."
      />
    </>
  );
}
