import { LIMITS, type ReelCursor } from '@carza/shared';
import type { TypedClient } from '../index';
import type { PostAuthor } from './posts';

const REEL_FIELDS = `
  id, video_path, poster_path, width, height, duration_seconds, caption, like_count, created_at,
  author:profiles!reels_author_id_fkey ( id, username, display_name, avatar_path )
` as const;

export type ReelView = {
  id: string;
  videoPath: string;
  posterPath: string;
  width: number;
  height: number;
  caption: string;
  likeCount: number;
  createdAt: string;
  author: PostAuthor;
  liked: boolean;
};

type ReelRow = {
  id: string;
  video_path: string;
  poster_path: string;
  width: number;
  height: number;
  caption: string;
  like_count: number;
  created_at: string;
  author: PostAuthor | null;
};

async function hydrate(client: TypedClient, rows: ReelRow[], viewerId: string | null) {
  let liked = new Set<string>();
  if (viewerId && rows.length) {
    const { data, error } = await client
      .from('reel_likes')
      .select('reel_id')
      .eq('user_id', viewerId)
      .in(
        'reel_id',
        rows.map((r) => r.id),
      );
    if (error) throw error;
    liked = new Set(data.map((l) => l.reel_id));
  }
  return rows.flatMap((r): ReelView[] =>
    r.author
      ? [
          {
            id: r.id,
            videoPath: r.video_path,
            posterPath: r.poster_path,
            width: r.width,
            height: r.height,
            caption: r.caption,
            likeCount: r.like_count,
            createdAt: r.created_at,
            author: r.author,
            liked: liked.has(r.id),
          },
        ]
      : [],
  );
}

export type ReelsPage = { reels: ReelView[]; next: ReelCursor | null };

/** Newest reels first, one page at a time. */
export async function getReels(
  client: TypedClient,
  cursor: ReelCursor,
  viewerId: string | null,
): Promise<ReelsPage> {
  const size = LIMITS.reelPageSize;
  let query = client
    .from('reels')
    .select(REEL_FIELDS)
    .order('created_at', { ascending: false })
    .order('id', { ascending: false })
    .limit(size);
  if (cursor.before && cursor.beforeId) {
    query = query.or(
      `created_at.lt.${cursor.before},and(created_at.eq.${cursor.before},id.lt.${cursor.beforeId})`,
    );
  }
  const { data, error } = await query;
  if (error) throw error;
  const reels = await hydrate(client, data, viewerId);
  const last = reels.at(-1);
  return {
    reels,
    next: reels.length === size && last ? { before: last.createdAt, beforeId: last.id } : null,
  };
}

export async function getReel(client: TypedClient, id: string, viewerId: string | null) {
  const { data, error } = await client.from('reels').select(REEL_FIELDS).eq('id', id).maybeSingle();
  if (error) throw error;
  return data ? ((await hydrate(client, [data], viewerId))[0] ?? null) : null;
}
