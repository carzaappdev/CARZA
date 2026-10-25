import type { ReactNode } from 'react';
import { SiteShell } from '@/components/layout/site-shell';
import { ACCOUNT_NAV } from '@/components/layout/nav';
import { NavLinks } from '@/components/layout/nav-links';
import { requireUser } from '@/lib/auth';

export default async function AccountLayout({ children }: { children: ReactNode }) {
  // The proxy already bounces signed-out requests; this is the authoritative server-side check.
  await requireUser('/account');
  return (
    <SiteShell>
      <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-6 px-4 py-6 sm:px-6 md:flex-row md:gap-10 md:py-10">
        <aside className="md:w-56 md:shrink-0">
          <div className="hidden md:block">
            <NavLinks items={ACCOUNT_NAV} label="Account" />
          </div>
          <div className="md:hidden">
            <NavLinks items={ACCOUNT_NAV} label="Account" orientation="horizontal" />
          </div>
        </aside>
        <div className="flex min-w-0 flex-1 flex-col gap-6">{children}</div>
      </div>
    </SiteShell>
  );
}
