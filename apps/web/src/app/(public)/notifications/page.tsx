import type { Metadata, Route } from 'next';
import Link from 'next/link';
import {
  BellIcon,
  CalendarCheckIcon,
  CalendarClockIcon,
  CalendarXIcon,
  HeartIcon,
  type LucideIcon,
  MessageCircleIcon,
  AtSignIcon,
  UserPlusIcon,
} from 'lucide-react';
import { getNotifications, type NotificationView } from '@carza/db';
import { describeNotification, formatRelativeTime } from '@carza/shared';
import { EmptyState } from '@/components/feedback/empty-state';
import { UserAvatar } from '@/components/feed/user-avatar';
import { MarkNotificationsRead } from '@/components/notifications/mark-read';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Notifications' };

const ICONS: Partial<Record<NotificationView['type'], [LucideIcon, string]>> = {
  new_follower: [UserPlusIcon, 'bg-violet-500'],
  post_like: [HeartIcon, 'bg-rose-500'],
  reel_like: [HeartIcon, 'bg-rose-500'],
  post_reply: [MessageCircleIcon, 'bg-sky-500'],
  reel_comment: [MessageCircleIcon, 'bg-sky-500'],
  mention: [AtSignIcon, 'bg-emerald-500'],
  event_rsvp: [CalendarCheckIcon, 'bg-amber-500'],
  event_reminder: [CalendarClockIcon, 'bg-amber-500'],
  event_cancelled: [CalendarXIcon, 'bg-zinc-500'],
};

export default async function NotificationsPage() {
  await requireUser('/notifications');
  const notifications = await getNotifications(await createClient());
  const items = notifications.flatMap((n) => {
    const described = describeNotification(n.type, n.data, n.actor);
    return described ? [{ ...n, ...described }] : [];
  });
  const hasUnread = items.some((n) => !n.read);

  return (
    <div className="mx-auto w-full max-w-[640px] flex-1 sm:border-x">
      <h1 className="font-display border-b px-4 py-4 text-xl font-bold tracking-tight">
        Notifications
      </h1>
      {hasUnread ? <MarkNotificationsRead /> : null}
      {items.length ? (
        <ul>
          {items.map((n) => {
            const [Icon, tint] = ICONS[n.type] ?? [BellIcon, 'bg-zinc-500'];
            return (
              <li key={n.id} className="border-b">
                <Link
                  href={n.href as Route}
                  className={cn(
                    'hover:bg-accent/50 focus-visible:ring-ring/50 flex gap-3 px-4 py-3.5 outline-none focus-visible:ring-[3px] focus-visible:ring-inset',
                    !n.read && 'bg-primary/[0.04]',
                  )}
                >
                  <span className="relative shrink-0">
                    {n.actor ? (
                      <UserAvatar
                        name={n.actor.display_name}
                        path={n.actor.avatar_path}
                        className="size-10"
                      />
                    ) : (
                      <span className="bg-muted grid size-10 place-items-center rounded-full">
                        <Icon className="text-muted-foreground size-5" aria-hidden />
                      </span>
                    )}
                    {n.actor ? (
                      <span
                        className={cn(
                          'ring-background absolute -right-1 -bottom-1 grid size-5 place-items-center rounded-full text-white ring-2',
                          tint,
                        )}
                      >
                        <Icon className="size-3 fill-current" aria-hidden />
                      </span>
                    ) : null}
                  </span>
                  <span className="min-w-0 flex-1 text-[15px] leading-snug">
                    {n.actor ? (
                      <span className="font-semibold">{n.actor.display_name} </span>
                    ) : null}
                    <span className="break-words">{n.text}</span>
                    <span className="text-muted-foreground block text-sm">
                      {formatRelativeTime(n.createdAt)}
                    </span>
                  </span>
                  {!n.read ? (
                    <span
                      className="bg-primary mt-2 size-2 shrink-0 rounded-full"
                      aria-label="New"
                    />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="p-4">
          <EmptyState
            Icon={BellIcon}
            title="Nothing yet"
            body="When people follow you, like or reply to your posts, or RSVP to your events, you’ll see it here."
          />
        </div>
      )}
    </div>
  );
}
