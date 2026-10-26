import type { Metadata } from 'next';
import Link from 'next/link';
import { HeartIcon } from 'lucide-react';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { SEARCH_HREF } from '@/components/layout/nav';

export const metadata: Metadata = { title: 'Saved' };

// Placeholder: the shell is real, the feature lands in its own PR.
export default function SavedPage() {
  return (
    <>
      <PageHeader title="Saved" description="Cars you’ve saved." />
      <EmptyState
        Icon={HeartIcon}
        title="Nothing saved yet"
        body="Tap the heart on a listing to keep it here."
        action={
          <Button asChild>
            <Link href={SEARCH_HREF}>Browse cars</Link>
          </Button>
        }
      />
    </>
  );
}
