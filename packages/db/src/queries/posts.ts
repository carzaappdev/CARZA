import { z } from 'zod';
import { LIMITS, postPhotoSchema, type FeedCursor, type PostPhoto } from '@carza/shared';
import type { TypedClient } from '../index';

const POST_FIELDS = `
  id, body, photos, like_count, reply_count, created_at, reply_to_id,
  author:profiles!posts_author_id_fkey ( id, username, display_name, avatar_path )
` as const;

const photosSchema = z.array(postPhotoSchema).catch([]);

export type PostAuthor = {
  id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
};

export type PostView = {
  id: string;
  body: string;
  photos: PostPhoto[];
  likeCount: number;
  replyCount: number;
  createdAt: string;
  replyToId: string | null;
  author: PostAuthor;
  liked: boolean;
};

type PostRow = {
  id: string;
  body: string;
  photos: unknown;
  like_count: number;
  reply_count: number;
  created_at: string;
  reply_to_id: string | null;
  author: PostAuthor | null;
};

/** Adds the viewer's likes and normalizes rows. Rows without an author (shouldn't happen) are dropped. */
async function hydrate(client: TypedClient, rows: PostRow[], viewerId: string | null) {
  const ids = rows.map((r) => r.id);
  let liked = new Set<string>();
  if (viewerId && ids.length) {
    const { data, error } = await client
      .from('post_likes')
      .select('post_id')
      .eq('user_id', viewerId)
      .in('post_id', ids);
    if (error) throw error;
    liked = new Set(data.map((l) => l.post_id));
  }
  return rows.flatMap((r): PostView[] =>
    r.author
      ? [
          {
            id: r.id,
            body: r.body,
            photos: photosSchema.parse(r.photos),
            likeCount: r.like_count,
            replyCount: r.reply_count,
            createdAt: r.created_at,
            replyToId: r.reply_to_id,
            author: r.author,
            liked: liked.has(r.id),
          },
        ]
      : [],
  );
}

export type FeedPage = { posts: PostView[]; next: FeedCursor | null };

function page(feed: FeedCursor['feed'], posts: PostView[], size: number): FeedPage {
  const last = posts.at(-1);
  return {
    posts,
    next:
      posts.length === size && last ? { feed, before: last.createdAt, beforeId: last.id } : null,
  };
}

/**
 * One page of a feed, newest first. "for-you" is every top-level post (one metro at launch, so recency
 * is the ranking); "following" is people the viewer follows plus their own posts.
 */
export async function getFeed(
  client: TypedClient,
  cursor: FeedCursor,
  viewerId: string | null,
): Promise<FeedPage> {
  const size = LIMITS.feedPageSize;
  if (cursor.feed === 'following') {
    if (!viewerId) return { posts: [], next: null };
    const { data, error } = await client
      .rpc('following_feed', {
        p_before: cursor.before ?? undefined,
        p_before_id: cursor.beforeId ?? undefined,
        p_limit: size,
      })
      .select(POST_FIELDS);
    if (error) throw error;
    return page('following', await hydrate(client, data, viewerId), size);
  }

  let query = client
    .from('posts')
    .select(POST_FIELDS)
    .is('reply_to_id', null)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(size);
  if (cursor.before && cursor.beforeId) {
    // (created_at, id) < (before, beforeId), spelled out for PostgREST.
    query = query.or(
      `created_at.lt.${cursor.before},and(created_at.eq.${cursor.before},id.lt.${cursor.beforeId})`,
    );
  }
  const { data, error } = await query;
  if (error) throw error;
  return page('for-you', await hydrate(client, data, viewerId), size);
}

/** One post, or null. */
export async function getPost(client: TypedClient, id: string, viewerId: string | null) {
  const { data, error } = await client.from('posts').select(POST_FIELDS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? ((await hydrate(client, [data], viewerId))[0] ?? null) : null;
}

/** Replies to a post, oldest first (reads as a conversation). */
export async function getReplies(client: TypedClient, postId: string, viewerId: string | null) {
  const { data, error } = await client
    .from('posts')
    .select(POST_FIELDS)
    .eq('reply_to_id', postId)
    .order('created_at', { ascending: true })
    .limit(200);
  if (error) throw error;
  return hydrate(client, data, viewerId);
}

/** A profile's posts (or replies), newest first. */
export async function getProfilePosts(
  client: TypedClient,
  authorId: string,
  kind: 'posts' | 'replies',
  viewerId: string | null,
) {
  const base = client.from('posts').select(POST_FIELDS).eq('author_id', authorId);
  const { data, error } = await (
    kind === 'posts' ? base.is('reply_to_id', null) : base.not('reply_to_id', 'is', null)
  )
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw error;
  return hydrate(client, data, viewerId);
}

/** A public profile with follow counts and whether the viewer follows them. */
export async function getProfile(client: TypedClient, username: string, viewerId: string | null) {
  const { data: profile, error } = await client
    .from('profiles')
    .select('id, username, display_name, avatar_path, bio, city, region, created_at')
    .eq('username', username)
    .maybeSingle();
  if (error) throw error;
  if (!profile) return null;

  const count = (column: 'follower_id' | 'followee_id') =>
    client.from('follows').select('*', { count: 'exact', head: true }).eq(column, profile.id);
  const isOther = viewerId !== null && viewerId !== profile.id;
  const [followers, following, viewerFollows, viewerBlocked] = await Promise.all([
    count('followee_id'),
    count('follower_id'),
    isOther
      ? client
          .from('follows')
          .select('followee_id')
          .eq('follower_id', viewerId)
          .eq('followee_id', profile.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    isOther
      ? client
          .from('blocks')
          .select('blocked_id')
          .eq('blocker_id', viewerId)
          .eq('blocked_id', profile.id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);
  if (followers.error) throw followers.error;
  if (following.error) throw following.error;
  if (viewerFollows.error) throw viewerFollows.error;
  if (viewerBlocked.error) throw viewerBlocked.error;
  return {
    ...profile,
    followerCount: followers.count ?? 0,
    followingCount: following.count ?? 0,
    viewerFollows: viewerFollows.data !== null,
    viewerBlocked: viewerBlocked.data !== null,
  };
}

export type ProfileView = NonNullable<Awaited<ReturnType<typeof getProfile>>>;
