import type { Route } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { MessagesSquareIcon, UsersIcon } from 'lucide-react';
import { getFeed } from '@carza/db';
import { EmptyState } from '@/components/feedback/empty-state';
import { Composer } from '@/components/feed/composer';
import { FeedList } from '@/components/feed/feed-list';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';
import { getViewer } from '@/lib/viewer';

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ feed?: string | string[] }>;
}) {
  const viewer = await getViewer();
  if (viewer) {
    // First visit after signing up: run the short setup first.
    const { data: setup } = await (
      await createClient()
    )
      .from('profile_private')
      .select('onboarded_at')
      .eq('user_id', viewer.id)
      .maybeSingle();
    if (setup && !setup.onboarded_at) redirect('/welcome');
  }
  const feed = (await searchParams).feed === 'following' && viewer ? 'following' : 'for-you';
  const initial = await getFeed(
    await createClient(),
    { feed, before: null, beforeId: null },
    viewer?.id ?? null,
  );

  return (
    <div className="mx-auto w-full max-w-[640px] flex-1 sm:border-x">
      <h1 className="sr-only">Feed</h1>
      <nav
        aria-label="Feeds"
        className="bg-background/95 sticky top-14 z-30 grid grid-cols-2 border-b backdrop-blur md:top-16"
      >
        <FeedTab href="/" active={feed === 'for-you'}>
          For you
        </FeedTab>
        <FeedTab
          href={
            (viewer
              ? '/?feed=following'
              : `/sign-in?next=${encodeURIComponent('/?feed=following')}`) as Route
          }
          active={feed === 'following'}
        >
          Following
        </FeedTab>
      </nav>

      {viewer ? (
        <Composer viewer={viewer} />
      ) : (
        <div className="flex items-center gap-3 border-b px-4 py-4">
          <p className="text-muted-foreground flex-1 text-[15px]">
            Join Carza to post, follow local car people and RSVP to meets.
          </p>
          <Button asChild size="sm" className="rounded-full">
            <Link href="/sign-up">Join</Link>
          </Button>
        </div>
      )}

      <FeedList
        key={`${feed}:${initial.posts[0]?.id ?? 'empty'}:${initial.posts.length}`}
        initial={initial}
        viewerId={viewer?.id ?? null}
        empty={
          feed === 'following' ? (
            <EmptyState
              Icon={UsersIcon}
              title="Nobody here yet"
              body="Follow people from their profile and their posts will show up here."
              action={
                <Button asChild variant="outline" className="rounded-full">
                  <Link href="/">See all posts</Link>
                </Button>
              }
            />
          ) : (
            <EmptyState
              Icon={MessagesSquareIcon}
              title="No posts yet"
              body="Be the first: share your ride, a build update or a question for local car people."
            />
          )
        }
      />
    </div>
  );
}

function FeedTab({
  href,
  active,
  children,
}: {
  href: Route;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'focus-visible:ring-ring/50 relative flex h-12 items-center justify-center text-[15px] font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-inset',
        active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
      )}
    >
      {children}
      {active ? (
        <span aria-hidden className="bg-foreground absolute inset-x-0 bottom-0 h-0.5" />
      ) : null}
    </Link>
  );
}
