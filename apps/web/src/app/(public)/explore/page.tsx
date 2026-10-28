import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { HashIcon, SearchIcon, UserRoundSearchIcon } from 'lucide-react';
import { getTrendingTags, searchPeople } from '@carza/db';
import { peopleQuerySchema } from '@carza/shared';
import { EmptyState } from '@/components/feedback/empty-state';
import { UserAvatar } from '@/components/feed/user-avatar';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Search' };

export default async function ExplorePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string | string[] }>;
}) {
  const raw = (await searchParams).q;
  const typed = typeof raw === 'string' ? raw : '';
  // "#e46" jumps straight to the tag.
  const query = peopleQuerySchema.parse(typed);
  const client = await createClient();
  const [people, trending] = await Promise.all([
    query.length >= 2 ? searchPeople(client, query) : Promise.resolve(null),
    getTrendingTags(client),
  ]);
  const tagQuery = typed.trim().startsWith('#') ? query.replace(/ /g, '').toLowerCase() : null;

  return (
    <div className="mx-auto w-full max-w-[640px] flex-1 sm:border-x">
      <h1 className="sr-only">Search</h1>
      <form action="/explore" className="border-b p-4">
        <label className="relative block">
          <span className="sr-only">Search people or #tags</span>
          <SearchIcon
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2"
            aria-hidden
          />
          <input
            name="q"
            type="search"
            defaultValue={typed}
            autoFocus={!typed}
            placeholder="Search people or #tags"
            enterKeyHint="search"
            className="bg-muted/60 focus-visible:ring-ring/50 h-12 w-full rounded-full pr-4 pl-11 text-base outline-none focus-visible:ring-[3px]"
          />
        </label>
      </form>

      {tagQuery && tagQuery.length >= 2 ? (
        <Link
          href={`/t/${tagQuery}` as Route}
          className="hover:bg-accent/50 flex items-center gap-3 border-b px-4 py-3"
        >
          <TagIcon />
          <span className="font-semibold">See posts tagged #{tagQuery}</span>
        </Link>
      ) : null}

      {people ? (
        people.length ? (
          <ul>
            {people.map((p) => (
              <li key={p.id} className="border-b">
                <Link
                  href={`/u/${p.username}` as Route}
                  className="hover:bg-accent/50 flex items-center gap-3 px-4 py-3"
                >
                  <UserAvatar name={p.display_name} path={p.avatar_path} className="size-11" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-semibold">{p.display_name}</span>
                    <span className="text-muted-foreground block truncate text-sm">
                      @{p.username}
                      {p.city ? ` · ${p.city}, ${p.region}` : ''}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : tagQuery ? null : (
          <div className="p-4">
            <EmptyState
              Icon={UserRoundSearchIcon}
              title="No one by that name"
              body="Try a username, or search a #tag like a model or a scene."
            />
          </div>
        )
      ) : (
        <section aria-labelledby="trending" className="px-4 py-5">
          <h2 id="trending" className="font-display mb-3 text-lg font-bold tracking-tight">
            Trending this week
          </h2>
          {trending.length ? (
            <ul className="flex flex-col">
              {trending.map((t, i) => (
                <li key={t.tag}>
                  <Link
                    href={`/t/${t.tag}` as Route}
                    className="hover:bg-accent/50 -mx-2 flex items-center gap-3 rounded-xl px-2 py-2.5"
                  >
                    <span className="text-muted-foreground w-5 text-right text-sm tabular-nums">
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">#{t.tag}</span>
                      <span className="text-muted-foreground block text-sm">
                        {t.postCount} {t.postCount === 1 ? 'post' : 'posts'}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground text-[15px]">
              Add #tags to your posts, like #e46 or #carsandcoffee, and the popular ones show up
              here.
            </p>
          )}
        </section>
      )}
    </div>
  );
}

function TagIcon() {
  return (
    <span className="bg-muted grid size-11 place-items-center rounded-full">
      <HashIcon className="size-5" aria-hidden />
    </span>
  );
}
