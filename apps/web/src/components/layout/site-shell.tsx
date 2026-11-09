import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { InstallPrompt } from '@/components/pwa/install-prompt';
import { getViewer } from '@/lib/viewer';
import { Header } from './header';
import { MobileTabBar } from './mobile-tab-bar';
import { HideOnReelPlayer } from './reel-player-chrome';

/** App shell: sticky header (tabs on desktop; hidden on phones in the reel player), the page, and bottom tabs on phones. */
export async function SiteShell({ children }: { children: ReactNode }) {
  // Everyone gives a date of birth once before using the app (Google/Apple sign-ins skip the sign-up form).
  const viewer = await getViewer();
  if (viewer && !viewer.ageGroup) redirect('/age');
  return (
    <div className="flex min-h-dvh flex-col pb-[calc(3.5rem+env(safe-area-inset-bottom))] md:pb-0">
      <a
        href="#main"
        className="bg-background focus-visible:ring-ring/50 sr-only z-50 rounded-md px-4 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus-visible:ring-[3px]"
      >
        Skip to content
      </a>
      <HideOnReelPlayer>
        <Header />
      </HideOnReelPlayer>
      <main id="main" className="flex flex-1 flex-col">
        {children}
      </main>
      <MobileTabBar />
      <InstallPrompt />
    </div>
  );
}
