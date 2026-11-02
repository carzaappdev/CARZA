'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import { SendIcon } from 'lucide-react';
import { unreadMessageCount } from '@/lib/actions/messages';
import { createClient } from '@/lib/supabase/browser';
import { cn } from '@/lib/utils';

/** Fired by an open thread after it marks itself read, so the badge updates right away. */
export const MESSAGES_SEEN = 'carza:messages-seen';

/**
 * Header link to the inbox with an unread badge. Updates live when a message arrives (Realtime only
 * delivers messages from the viewer's own threads), on navigation, on tab focus, and every minute.
 */
export function InboxButton({
  initialCount,
  viewerId,
}: {
  initialCount: number;
  viewerId: string;
}) {
  const [count, setCount] = useState(initialCount);
  const pathname = usePathname();
  const active = pathname === '/messages' || pathname.startsWith('/messages/');

  useEffect(() => {
    let cancelled = false;
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      void unreadMessageCount().then((r) => {
        if (!cancelled && r.ok) setCount(r.data.count);
      });
    };
    refresh();
    const timer = window.setInterval(refresh, 60_000);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener(MESSAGES_SEEN, refresh);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener(MESSAGES_SEEN, refresh);
    };
  }, [pathname]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`inbox:${viewerId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const sender = (payload.new as { sender_id?: string | null }).sender_id;
          if (sender && sender !== viewerId) {
            void unreadMessageCount().then((r) => {
              if (r.ok) setCount(r.data.count);
            });
          }
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [viewerId]);

  const label = count ? `Messages, ${count} unread` : 'Messages';
  return (
    <Link
      href="/messages"
      aria-label={label}
      aria-current={pathname === '/messages' ? 'page' : undefined}
      className="hover:bg-accent focus-visible:ring-ring/50 relative grid size-11 place-items-center rounded-full outline-none focus-visible:ring-[3px]"
    >
      <SendIcon className={cn('size-5', active && 'fill-current')} aria-hidden />
      {count ? (
        <span className="bg-destructive ring-background absolute top-1.5 right-1.5 grid h-[18px] min-w-[18px] place-items-center rounded-full px-1 text-[11px] leading-none font-bold text-white tabular-nums ring-2">
          {count > 99 ? '99+' : count}
        </span>
      ) : null}
    </Link>
  );
}
