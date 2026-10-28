import {
  SOCIAL_NOTIFICATION_TYPES,
  notificationDataSchema,
  type NOTIFICATION_TYPES,
  type NotificationData,
} from '@carza/shared';
import type { TypedClient } from '../index';
import type { PostAuthor } from './posts';

export type NotificationView = {
  id: string;
  type: (typeof NOTIFICATION_TYPES)[number];
  data: NotificationData;
  actor: PostAuthor | null;
  read: boolean;
  createdAt: string;
};

/** The viewer's latest notifications (RLS limits them to their own), with who did each thing. */
export async function getNotifications(
  client: TypedClient,
  limit = 60,
): Promise<NotificationView[]> {
  const { data, error } = await client
    .from('notifications')
    .select('id, type, data, read_at, created_at')
    .in('type', [...SOCIAL_NOTIFICATION_TYPES])
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;

  const rows = data.map((n) => ({ ...n, parsed: notificationDataSchema.parse(n.data) }));
  const actorIds = [
    ...new Set(rows.flatMap((r) => (r.parsed.actor_id ? [r.parsed.actor_id] : []))),
  ];
  const actors = new Map<string, PostAuthor>();
  if (actorIds.length) {
    const { data: profiles, error: pErr } = await client
      .from('profiles')
      .select('id, username, display_name, avatar_path')
      .in('id', actorIds);
    if (pErr) throw pErr;
    for (const p of profiles) actors.set(p.id, p);
  }
  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    data: r.parsed,
    actor: r.parsed.actor_id ? (actors.get(r.parsed.actor_id) ?? null) : null,
    read: r.read_at !== null,
    createdAt: r.created_at,
  }));
}

/** How many unread notifications the viewer has (0 when signed out). */
export async function getUnreadCount(client: TypedClient): Promise<number> {
  const { count, error } = await client
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .in('type', [...SOCIAL_NOTIFICATION_TYPES])
    .is('read_at', null);
  if (error) throw error;
  return count ?? 0;
}
