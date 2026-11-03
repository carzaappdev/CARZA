'use client';

import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { isReelPlayer } from './nav';
import { TabLinks } from './tab-links';

/**
 * Fixed bottom tabs on phones. The site shell pads the page so content never hides under it.
 * On the reel player it uses the dark palette, so a light theme doesn't put a white bar under black video.
 */
export function MobileTabBar() {
  const dark = isReelPlayer(usePathname());
  return (
    <nav
      aria-label="Main"
      className={cn(
        'bg-background/95 supports-[backdrop-filter]:bg-background/80 text-foreground fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden',
        dark && 'dark',
      )}
    >
      <TabLinks variant="bar" />
    </nav>
  );
}
