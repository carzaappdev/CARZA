import type { ReactNode } from 'react';
import { Footer } from './footer';
import { Header } from './header';
import { MobileTabBar } from './mobile-tab-bar';

/** Consumer-facing shell: sticky header, page, footer, and bottom tabs on phones. */
export function SiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
      <a
        href="#main"
        className="bg-background focus-visible:ring-ring/50 sr-only z-50 rounded-md px-4 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus-visible:ring-[3px]"
      >
        Skip to content
      </a>
      <Header />
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
      <Footer />
      <MobileTabBar />
    </div>
  );
}
