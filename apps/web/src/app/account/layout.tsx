import type { ReactNode } from 'react';
import { SiteShell } from '@/components/layout/site-shell';
import { requireUser } from '@/lib/auth';

export default async function AccountLayout({ children }: { children: ReactNode }) {
  // The proxy already bounces signed-out requests; this is the authoritative server-side check.
  await requireUser('/account');
  return (
    <SiteShell>
      <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-6 px-4 py-6 md:py-10">
        {children}
      </div>
    </SiteShell>
  );
}
