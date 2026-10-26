import type { ReactNode } from 'react';
import { DealerSidebar } from '@/components/layout/dealer-sidebar';
import { PendingBanner } from '@/components/layout/pending-banner';
import { requireDealerMember } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export default async function DealerLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ dealershipId: string }>;
}) {
  const { dealershipId } = await params;
  // Non-members get a 404. Every dealer action re-checks membership; RLS is the final guard.
  const { user, dealership } = await requireDealerMember(dealershipId);

  const supabase = await createClient();
  const { data: memberships } = await supabase
    .from('dealership_members')
    .select('dealerships ( id, name )')
    .eq('user_id', user.id);
  const options = (memberships ?? [])
    .flatMap((m) => (m.dealerships ? [m.dealerships] : []))
    .sort((a, b) => a.name.localeCompare(b.name));

  return (
    <div className="min-h-dvh md:flex">
      <DealerSidebar current={{ id: dealership.id, name: dealership.name }} options={options} />
      <div className="flex min-w-0 flex-1 flex-col">
        <PendingBanner status={dealership.verification_status} />
        <main
          id="main"
          className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 md:py-10"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
