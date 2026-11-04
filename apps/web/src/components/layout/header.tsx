import Link from 'next/link';
import { SearchIcon } from 'lucide-react';
import { getUnreadCount, getUnreadMessageCount } from '@carza/db';
import { CarzaLogo } from '@/components/brand/logo';
import { InboxButton } from '@/components/messages/inbox-button';
import { NotificationBell } from '@/components/notifications/bell';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/viewer';
import { AccountMenu } from './account-menu';
import { TabLinks } from './tab-links';

export async function Header() {
  const viewer = await getViewer();
  const supabase = viewer ? await createClient() : null;
  const [unread, unreadMessages] = supabase
    ? await Promise.all([
        getUnreadCount(supabase).catch(() => 0),
        getUnreadMessageCount(supabase).catch(() => 0),
      ])
    : [0, 0];
  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto grid h-14 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 sm:px-6 md:h-16">
        <CarzaLogo size="sm" />
        <nav aria-label="Main" className="hidden md:block">
          <TabLinks variant="header" />
        </nav>
        <div className="col-start-3 flex items-center justify-end gap-1">
          <Link
            href="/explore"
            aria-label="Search people and tags"
            className="hover:bg-accent focus-visible:ring-ring/50 grid size-11 place-items-center rounded-full outline-none focus-visible:ring-[3px]"
          >
            <SearchIcon className="size-5" aria-hidden />
          </Link>
          {/* Phones have little room up here; the theme picker is also in Settings. */}
          <span className="hidden sm:contents">
            <ThemeToggle />
          </span>
          {viewer ? (
            <>
              <InboxButton initialCount={unreadMessages} viewerId={viewer.id} />
              <NotificationBell initialCount={unread} />
              <AccountMenu viewer={viewer} />
            </>
          ) : (
            <Button asChild size="sm" className="rounded-full">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
