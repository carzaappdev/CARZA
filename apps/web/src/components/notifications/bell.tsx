'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { BellIcon } from 'lucide-react';
import { unreadNotificationCount } from '@/lib/actions/notifications';
import { cn } from '@/lib/utils';

export const NOTIFICATIONS_SEEN = 'carza:notifications-seen';

/** Header bell with an unread badge. Refreshes on navigation, when the tab regains focus, and every minute. */
export function NotificationBell({ initialCount }: { initialCount: number }) {
  const [count, setCount] = useState(initialCount);
  const pathname = usePathname();

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      void unreadNotificationCount().then((r) => {
        if (!cancelled && r.ok) setCount(r.data.count);
      });
    };
    const seen = () => setCount(0);
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener(NOTIFICATIONS_SEEN, seen);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener(NOTIFICATIONS_SEEN, seen);
    };
  }, [pathname]);

  const label = count ? `Notifications, ${count} new` : 'Notifications';
  return (
    <Link
      href="/notifications"
      aria-label={label}
      aria-current={pathname === '/notifications' ? 'page' : undefined}
      className="hover:bg-accent focus-visible:ring-ring/50 relative grid size-11 place-items-center rounded-full outline-none focus-visible:ring-[3px]"
    >
      <BellIcon
        className={cn('size-5', pathname === '/notifications' && 'fill-current')}
        aria-hidden
      />
      {count ? (
        <span className="bg-destructive ring-background absolute top-1.5 right-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[11px] leading-none font-bold text-white tabular-nums ring-2">
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Link>
  );
}
