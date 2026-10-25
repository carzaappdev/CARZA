import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { ChevronRightIcon, StoreIcon } from 'lucide-react';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Dealer dashboard' };

// Entry point: no membership → apply; one → straight in; several → pick one.
export default async function DealerIndexPage() {
  const user = await requireUser('/dealer');
  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from('dealership_members')
    .select('dealership_id, role, dealerships ( name, verification_status )')
    .eq('user_id', user.id);

  const only = memberships?.length === 1 ? memberships[0] : undefined;
  if (only) redirect(`/dealer/${only.dealership_id}`);

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 px-4 py-8 sm:px-6">
      <PageHeader title="Dealer dashboard" />
      {memberships?.length ? (
        <ul className="divide-y rounded-xl border">
          {memberships.map((m) => (
            <li key={m.dealership_id}>
              <Link
                href={`/dealer/${m.dealership_id}`}
                className="hover:bg-accent flex min-h-14 items-center gap-3 px-4"
              >
                <span className="flex-1 font-medium">{m.dealerships?.name}</span>
                <span className="text-muted-foreground text-sm capitalize">{m.role}</span>
                <ChevronRightIcon className="text-muted-foreground size-4" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          Icon={StoreIcon}
          title="You're not part of a dealership yet"
          body="Apply to list your dealership's inventory, take leads and book test drives."
          action={
            <Button asChild>
              <Link href="/dealer/apply">Become a dealer</Link>
            </Button>
          }
        />
      )}
    </div>
  );
}
