import type { TypedClient } from '../index';

const PERSON_FIELDS = 'id, username, display_name, avatar_path, bio';

/**
 * Who follows a profile (`followers`) or who it follows (`following`), newest first, with whether the
 * viewer follows each person. Follows are public, so this runs fine signed out.
 */
export async function getFollowList(
  client: TypedClient,
  profileId: string,
  kind: 'followers' | 'following',
  viewerId: string | null,
) {
  const query =
    kind === 'followers'
      ? client
          .from('follows')
          .select(`person:profiles!follows_follower_id_fkey ( ${PERSON_FIELDS} )`)
          .eq('followee_id', profileId)
      : client
          .from('follows')
          .select(`person:profiles!follows_followee_id_fkey ( ${PERSON_FIELDS} )`)
          .eq('follower_id', profileId);
  const { data, error } = await query.order('created_at', { ascending: false }).limit(200);
  if (error) throw error;
  const people = data.flatMap((row) => (row.person ? [row.person] : []));

  let followed = new Set<string>();
  if (viewerId && people.length) {
    const { data: mine, error: mineError } = await client
      .from('follows')
      .select('followee_id')
      .eq('follower_id', viewerId)
      .in(
        'followee_id',
        people.map((p) => p.id),
      );
    if (mineError) throw mineError;
    followed = new Set(mine.map((f) => f.followee_id));
  }
  return people.map((p) => ({ ...p, viewerFollows: followed.has(p.id) }));
}

export type FollowListPerson = Awaited<ReturnType<typeof getFollowList>>[number];
