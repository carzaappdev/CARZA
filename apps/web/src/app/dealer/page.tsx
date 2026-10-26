import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
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
    <main className="mx-auto flex max-w-xl flex-col gap-4 px-4 py-10">
      <h1 className="text-2xl font-semibold">Dealer dashboard</h1>
      {memberships?.length ? (
        <ul className="flex flex-col gap-2">
          {memberships.map((m) => (
            <li key={m.dealership_id}>
              <Link href={`/dealer/${m.dealership_id}`} className="text-primary font-medium">
                {m.dealerships?.name}
              </Link>{' '}
              <span className="text-muted-foreground text-sm">({m.role})</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-muted-foreground">
          You&apos;re not part of a dealership yet. Applying opens soon.
        </p>
      )}
    </main>
  );
}
