import type { Metadata } from 'next';
import Link from 'next/link';
import { MessageSquareIcon } from 'lucide-react';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { SEARCH_HREF } from '@/components/layout/nav';

export const metadata: Metadata = { title: 'Messages' };

// Placeholder: the shell is real, the feature lands in its own PR.
export default function MessagesPage() {
  return (
    <>
      <PageHeader title="Messages" description="Your conversations with sellers and buyers." />
      <EmptyState
        Icon={MessageSquareIcon}
        title="No messages yet"
        body="When you message a seller, or a buyer messages you, it shows up here."
        action={
          <Button asChild>
            <Link href={SEARCH_HREF}>Browse cars</Link>
          </Button>
        }
      />
    </>
  );
}
