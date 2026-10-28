import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { MessagesSquareIcon } from 'lucide-react';
import { getProfile, getGarage, getProfilePosts } from '@carza/db';
import { formatCount } from '@carza/shared';
import { EmptyState } from '@/components/feedback/empty-state';
import { FollowButton } from '@/components/feed/follow-button';
import { FeatureToggle } from '@/components/founders/feature-toggle';
import { ProfileBadges } from '@/components/founders/founder-badge';
import { GarageShowcase } from '@/components/garage/garage-showcase';
import { SafetyMenu } from '@/components/safety/safety-menu';
import { UnblockButton } from '@/components/safety/unblock-button';
import { PostCard } from '@/components/feed/post-card';
import { UserAvatar } from '@/components/feed/user-avatar';
import { ShareButton } from '@/components/listings/share-button';
import { Button } from '@/components/ui/button';
import { getUser, isAdmin } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';

type Props = {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ tab?: string | string[] }>;
};

const loadProfile = cache(async (username: string) => {
  if (!/^[a-z0-9_]{3,30}$/.test(username)) return null;
  const user = await getUser();
  return getProfile(await createClient(), username, user?.id ?? null);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const profile = await loadProfile((await params).username);
  if (!profile) return { title: 'Profile not found' };
  return {
    title: `${profile.display_name} (@${profile.username})`,
    description: profile.bio ?? undefined,
  };
}

export default async function ProfilePage({ params, searchParams }: Props) {
  const { username } = await params;
  const profile = await loadProfile(username);
  if (!profile) notFound();

  const tab = (await searchParams).tab === 'replies' ? 'replies' : 'posts';
  const user = await getUser();
  const viewerId = user?.id ?? null;
  const isOwn = viewerId === profile.id;
  const supabase = await createClient();
  const [posts, garage, admin, invites] = await Promise.all([
    getProfilePosts(supabase, profile.id, tab, viewerId),
    getGarage(supabase, profile.id),
    viewerId && !isOwn ? isAdmin() : false,
    isOwn ? supabase.rpc('my_invite_count').then((r) => r.data ?? 0) : 0,
  ]);
  const base = `/u/${profile.username}`;

  return (
    <div className="mx-auto w-full max-w-[640px] flex-1 sm:border-x">
      <header className="flex flex-col gap-4 px-4 pt-6 pb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="font-display truncate text-2xl font-bold tracking-tight">
              {profile.display_name}
            </h1>
            <p className="text-muted-foreground truncate">@{profile.username}</p>
          </div>
          <div className="flex items-start gap-1">
            <UserAvatar name={profile.display_name} path={profile.avatar_path} large />
            {profile.viewerBlocked ? null : (
              <SafetyMenu
                targetType="user"
                targetId={profile.id}
                owner={profile}
                viewerId={viewerId}
                className="-mr-2"
              />
            )}
          </div>
        </div>
        <ProfileBadges
          foundingNumber={profile.founding_number}
          featured={profile.featured_at !== null}
        />
        {admin ? (
          <FeatureToggle userId={profile.id} featured={profile.featured_at !== null} />
        ) : null}
        {profile.bio ? (
          <p className="text-[15px] leading-[1.4] whitespace-pre-wrap">{profile.bio}</p>
        ) : null}
        <GarageShowcase cars={garage} />
        <p className="text-muted-foreground text-sm">
          <span className="text-foreground font-semibold tabular-nums">
            {formatCount(profile.followerCount)}
          </span>{' '}
          {profile.followerCount === 1 ? 'follower' : 'followers'}
          <span aria-hidden> · </span>
          <span className="text-foreground font-semibold tabular-nums">
            {formatCount(profile.followingCount)}
          </span>{' '}
          following
          {profile.city ? (
            <>
              <span aria-hidden> · </span>
              {profile.region ? `${profile.city}, ${profile.region}` : profile.city}
            </>
          ) : null}
        </p>
        {isOwn ? (
          <div className="grid grid-cols-2 gap-2">
            <Button asChild variant="outline" className="rounded-xl">
              <Link href="/account/settings">Edit profile</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl">
              <Link href={garage.length ? '/account/garage' : '/account/garage/new'}>
                {garage.length ? 'My Garage' : 'Add your car'}
              </Link>
            </Button>
            <ShareButton
              title="Join me on Carza"
              path={`/join/${profile.username}`}
              label={invites ? `Invite friends · ${invites} joined` : 'Invite friends'}
              className="col-span-2 rounded-xl"
            />
          </div>
        ) : profile.viewerBlocked ? (
          <UnblockButton userId={profile.id} username={profile.username} />
        ) : (
          <FollowButton
            userId={profile.id}
            following={profile.viewerFollows}
            signedIn={viewerId !== null}
            className="w-full rounded-xl"
          />
        )}
      </header>

      <nav aria-label="Profile sections" className="grid grid-cols-2 border-b">
        {(['posts', 'replies'] as const).map((t) => (
          <Link
            key={t}
            href={(t === 'posts' ? base : `${base}?tab=replies`) as Route}
            aria-current={tab === t ? 'page' : undefined}
            className={cn(
              'focus-visible:ring-ring/50 relative flex h-12 items-center justify-center text-[15px] font-semibold capitalize outline-none focus-visible:ring-[3px] focus-visible:ring-inset',
              tab === t ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            {t}
            {tab === t ? (
              <span aria-hidden className="bg-foreground absolute inset-x-0 bottom-0 h-0.5" />
            ) : null}
          </Link>
        ))}
      </nav>

      {posts.length > 0 ? (
        <ul>
          {posts.map((post) => (
            <li key={post.id}>
              <PostCard post={post} viewerId={viewerId} showReplyContext={tab === 'replies'} />
            </li>
          ))}
        </ul>
      ) : (
        <div className="px-4 py-8">
          <EmptyState
            Icon={MessagesSquareIcon}
            title={tab === 'posts' ? 'No posts yet' : 'No replies yet'}
            body={isOwn ? 'Your posts show up here. Share your ride from the feed.' : undefined}
            action={
              isOwn && tab === 'posts' ? (
                <Button asChild className="rounded-full">
                  <Link href="/">Write a post</Link>
                </Button>
              ) : undefined
            }
          />
        </div>
      )}
    </div>
  );
}
