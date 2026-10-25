import { requireDealerMember } from '@/lib/auth';

// Placeholder until the app-shell stage. Proves the membership guard: non-members get a 404.
export default async function DealerDashboardPage({
  params,
}: {
  params: Promise<{ dealershipId: string }>;
}) {
  const { dealershipId } = await params;
  const { dealership, role } = await requireDealerMember(dealershipId);
  return (
    <main className="mx-auto flex max-w-xl flex-col gap-2 px-4 py-10">
      <h1 className="text-2xl font-semibold">{dealership.name}</h1>
      <p className="text-muted-foreground">
        Your role: {role} · Status: {dealership.verification_status}
      </p>
    </main>
  );
}
