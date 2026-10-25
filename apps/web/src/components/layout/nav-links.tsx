'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { isActive, type NavItem } from './nav';

/** A vertical (sidebar) or horizontal (scrolling tabs) list of section links with the current one marked. */
export function NavLinks({
  items,
  label,
  orientation = 'vertical',
  onNavigate,
}: {
  items: NavItem[];
  label: string;
  orientation?: 'vertical' | 'horizontal';
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const vertical = orientation === 'vertical';
  return (
    <nav aria-label={label}>
      <ul className={cn('flex gap-1', vertical ? 'flex-col' : '-mx-4 overflow-x-auto px-4')}>
        {items.map((item) => {
          const active = isActive(item, pathname, items);
          return (
            <li key={item.href} className="shrink-0">
              <Link
                href={item.href}
                aria-current={active ? 'page' : undefined}
                onClick={onNavigate}
                className={cn(
                  'focus-visible:ring-ring/50 flex min-h-11 items-center gap-3 rounded-md px-3 text-sm font-medium outline-none focus-visible:ring-[3px]',
                  active
                    ? 'bg-accent text-accent-foreground'
                    : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                )}
              >
                <item.Icon className="size-4 shrink-0" aria-hidden />
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
