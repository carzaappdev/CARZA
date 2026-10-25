'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { isActive, TAB_BAR } from './nav';

/** Fixed bottom tabs on phones. The site shell pads the page so content never hides under it. */
export function MobileTabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <ul className="grid grid-cols-5">
        {TAB_BAR.map((item) => {
          const active = isActive(item, pathname, TAB_BAR);
          return (
            <li key={item.href}>
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'focus-visible:ring-ring/50 flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium outline-none focus-visible:ring-[3px] focus-visible:ring-inset',
                  active ? 'text-foreground' : 'text-muted-foreground',
                )}
              >
                <item.Icon className="size-5" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
