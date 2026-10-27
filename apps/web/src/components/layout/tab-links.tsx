'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { isActive, TAB_BAR } from './nav';

/** The three app tabs. `bar` is the fixed bottom bar on phones; `header` is the row in the desktop header. */
export function TabLinks({ variant }: { variant: 'bar' | 'header' }) {
  const pathname = usePathname();
  const bar = variant === 'bar';
  return (
    <ul className={cn(bar ? 'grid grid-cols-3' : 'flex items-center gap-1')}>
      {TAB_BAR.map((item) => {
        const active = isActive(item, pathname, TAB_BAR);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'focus-visible:ring-ring/50 outline-none focus-visible:ring-[3px] transition-colors',
                bar
                  ? 'flex h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-medium focus-visible:ring-inset'
                  : 'flex h-10 items-center gap-2 rounded-full px-4 text-sm font-semibold',
                active
                  ? bar
                    ? 'text-foreground'
                    : 'bg-accent text-foreground'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <item.Icon className={cn('size-5', bar && active && 'stroke-[2.5]')} aria-hidden />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
