import type { Route } from 'next';
import Link from 'next/link';
import { getSuggestedFollows, getTrendingTags } from '@carza/db';
import { createClient } from '@/lib/supabase/server';
import { FollowButton } from './follow-button';
import { UserAvatar } from './user-avatar';

/** Desktop-only column beside the feed: trending #tags and people to follow. */
export async function FeedRail({ signedIn }: { signedIn: boolean }) {
  const client = await createClient();
  const [trending, people] = await Promise.all([
    getTrendingTags(client, 6).catch(() => []),
    signedIn ? getSuggestedFollows(client, 4).catch(() => []) : [],
  ]);
  if (!trending.length && !people.length) return null;

  return (
    <aside
      aria-label="Discover"
      className="sticky top-20 hidden w-[300px] shrink-0 flex-col gap-4 self-start py-4 xl:flex"
    >
      {people.length ? (
        <section aria-labelledby="rail-people" className="rounded-2xl border p-4">
          <h2 id="rail-people" className="mb-2 font-semibold">
            People to follow
          </h2>
          <ul className="flex flex-col">
            {people.map((p) => (
              <li key={p.id} className="flex items-center gap-3 py-2">
                <Link
                  href={`/u/${p.username}` as Route}
                  className="flex min-w-0 flex-1 items-center gap-3"
                >
                  <UserAvatar name={p.display_name} path={p.avatar_path} />
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-semibold hover:underline">
                      {p.display_name}
                    </span>
                    <span className="text-muted-foreground block truncate text-xs">
                      @{p.username}
                    </span>
                  </span>
                </Link>
                <FollowButton
                  userId={p.id}
                  following={false}
                  signedIn
                  size="sm"
                  className="rounded-full"
                />
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {trending.length ? (
        <section aria-labelledby="rail-trending" className="rounded-2xl border p-4">
          <h2 id="rail-trending" className="mb-1 font-semibold">
            Trending this week
          </h2>
          <ul>
            {trending.map((t) => (
              <li key={t.tag}>
                <Link
                  href={`/t/${t.tag}` as Route}
                  className="hover:bg-accent/50 -mx-2 block rounded-lg px-2 py-1.5"
                >
                  <span className="block truncate text-sm font-semibold">#{t.tag}</span>
                  <span className="text-muted-foreground block text-xs">
                    {t.postCount} {t.postCount === 1 ? 'post' : 'posts'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <Link
            href="/explore"
            className="text-muted-foreground mt-1 block text-sm hover:underline"
          >
            Search Carza
          </Link>
        </section>
      ) : null}
    </aside>
  );
}
