import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { SendIcon } from 'lucide-react';
import { getInbox } from '@carza/db';
import { formatRelativeTime } from '@carza/shared';
import { EmptyState } from '@/components/feedback/empty-state';
import { UserAvatar } from '@/components/feed/user-avatar';
import { Button } from '@/components/ui/button';
import { requireUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';

export const metadata: Metadata = { title: 'Messages' };

export default async function MessagesPage() {
  const user = await requireUser('/messages');
  const threads = await getInbox(await createClient(), user.id);

  return (
    <div className="mx-auto w-full max-w-[640px] flex-1 sm:border-x">
      <h1 className="font-display border-b px-4 py-4 text-xl font-bold tracking-tight">Messages</h1>
      {threads.length ? (
        <ul>
          {threads.map((t) => (
            <li key={t.conversationId} className="border-b">
              <Link
                href={`/messages/${t.conversationId}` as Route}
                className="hover:bg-accent/50 focus-visible:ring-ring/50 flex items-center gap-3 px-4 py-3 outline-none focus-visible:ring-[3px] focus-visible:ring-inset"
              >
                <UserAvatar
                  name={t.other.display_name}
                  path={t.other.avatar_path}
                  className="size-12"
                />
                <span className="min-w-0 flex-1">
                  <span className="flex items-baseline gap-1.5">
                    <span className={cn('truncate text-[15px]', t.unread && 'font-bold')}>
                      {t.other.display_name}
                    </span>
                    <span className="text-muted-foreground shrink-0 text-sm">
                      · {formatRelativeTime(t.lastMessageAt)}
                    </span>
                  </span>
                  <span
                    className={cn(
                      'block truncate text-sm',
                      t.unread ? 'text-foreground font-semibold' : 'text-muted-foreground',
                    )}
                  >
                    {t.lastFromViewer ? 'You: ' : ''}
                    {t.lastBody}
                  </span>
                </span>
                {t.unread ? (
                  <span className="bg-primary size-2.5 shrink-0 rounded-full" aria-label="Unread" />
                ) : null}
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="p-4">
          <EmptyState
            Icon={SendIcon}
            title="No messages yet"
            body="Message someone from their profile. Plan a cruise, ask about a build, or just say hi."
            action={
              <Button asChild className="rounded-full">
                <Link href="/explore">Find people</Link>
              </Button>
            }
          />
        </div>
      )}
    </div>
  );
}
