import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { ArrowLeftIcon, UsersRoundIcon } from 'lucide-react';
import { getFollowList, getProfile } from '@carza/db';
import { formatCount } from '@carza/shared';
import { EmptyState } from '@/components/feedback/empty-state';
import { FollowButton } from '@/components/feed/follow-button';
import { UserAvatar } from '@/components/feed/user-avatar';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';

type Props = { params: Promise<{ username: string; list: string }> };

const LISTS = ['followers', 'following'] as const;
type List = (typeof LISTS)[number];
const isList = (v: string): v is List => (LISTS as readonly string[]).includes(v);

const loadProfile = cache(async (username: string) => {
  if (!/^[a-z0-9_]{3,30}$/.test(username)) return null;
  const user = await getUser();
  return getProfile(await createClient(), username, user?.id ?? null);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { username, list } = await params;
  const profile = isList(list) ? await loadProfile(username) : null;
  if (!profile) return { title: 'Profile not found' };
  return {
    title: `${list === 'followers' ? 'Followers of' : 'People followed by'} ${profile.display_name}`,
    robots: { index: false },
  };
}

export default async function FollowListPage({ params }: Props) {
  const { username, list } = await params;
  if (!isList(list)) notFound();
  const profile = await loadProfile(username);
  if (!profile) notFound();

  const user = await getUser();
  const viewerId = user?.id ?? null;
  const people = await getFollowList(await createClient(), profile.id, list, viewerId);
  const base = `/u/${profile.username}`;
  const counts = { followers: profile.followerCount, following: profile.followingCount };
  const isOwn = viewerId === profile.id;

  return (
    <div className="mx-auto w-full max-w-[640px] flex-1 sm:border-x">
      <header className="flex items-center gap-2 px-2 pt-3 pb-1">
        <Link
          href={base as Route}
          aria-label={`Back to ${profile.display_name}’s profile`}
          className="hover:bg-accent focus-visible:ring-ring/50 grid size-10 place-items-center rounded-full outline-none focus-visible:ring-[3px]"
        >
          <ArrowLeftIcon className="size-5" aria-hidden />
        </Link>
        <div className="min-w-0">
          <h1 className="font-display truncate text-lg leading-tight font-bold">
            {profile.display_name}
          </h1>
          <p className="text-muted-foreground truncate text-sm">@{profile.username}</p>
        </div>
      </header>

      <nav aria-label="Followers and following" className="grid grid-cols-2 border-b">
        {LISTS.map((t) => (
          <Link
            key={t}
            href={`${base}/${t}` as Route}
            aria-current={list === t ? 'page' : undefined}
            className={cn(
              'focus-visible:ring-ring/50 relative flex h-12 items-center justify-center gap-1.5 text-[15px] font-semibold capitalize outline-none focus-visible:ring-[3px] focus-visible:ring-inset',
              list === t ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t}
            <span className="text-muted-foreground font-normal tabular-nums">
              {formatCount(counts[t])}
            </span>
            {list === t ? (
              <span aria-hidden className="bg-foreground absolute inset-x-0 bottom-0 h-0.5" />
            ) : null}
          </Link>
        ))}
      </nav>

      {people.length ? (
        <ul>
          {people.map((p) => (
            <li key={p.id} className="flex items-center gap-3 border-b px-4 py-3">
              <Link
                href={`/u/${p.username}` as Route}
                className="focus-visible:ring-ring/50 flex min-w-0 flex-1 items-center gap-3 rounded-lg outline-none focus-visible:ring-[3px]"
              >
                <UserAvatar name={p.display_name} path={p.avatar_path} className="size-11" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-semibold">{p.display_name}</span>
                  <span className="text-muted-foreground block truncate text-sm">
                    @{p.username}
                  </span>
                  {p.bio ? <span className="block truncate text-sm">{p.bio}</span> : null}
                </span>
              </Link>
              {p.id === viewerId ? null : (
                <FollowButton
                  userId={p.id}
                  following={p.viewerFollows}
                  signedIn={viewerId !== null}
                  size="sm"
                  className="w-24 shrink-0 rounded-lg"
                />
              )}
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-4 py-8">
          <EmptyState
            Icon={UsersRoundIcon}
            title={list === 'followers' ? 'No followers yet' : 'Not following anyone yet'}
            body={
              isOwn
                ? list === 'followers'
                  ? 'Post your car and invite friends. People who follow you show up here.'
                  : 'Find people from your area in Search, or on any post in the feed.'
                : undefined
            }
          />
        </div>
      )}
    </div>
  );
}
