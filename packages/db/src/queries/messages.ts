import type { TypedClient } from '../index';
import type { PostAuthor } from './posts';

export const MESSAGE_PAGE_SIZE = 50;

export type InboxItem = {
  conversationId: string;
  other: PostAuthor;
  lastBody: string;
  lastFromViewer: boolean;
  lastMessageAt: string;
  unread: boolean;
};

export type MessageView = {
  id: string;
  senderId: string | null;
  body: string;
  createdAt: string;
};

export type ConversationView = {
  id: string;
  other: PostAuthor;
  /** The viewer blocked the other person (only the blocker can see a block). */
  viewerBlocked: boolean;
  /** Newest page, oldest first. */
  messages: MessageView[];
  hasOlder: boolean;
};

/** The viewer's DM threads, newest first. Blocked people and empty threads are left out. */
export async function getInbox(client: TypedClient, viewerId: string): Promise<InboxItem[]> {
  const { data, error } = await client.rpc('direct_inbox', { p_limit: 50 });
  if (error) throw error;
  return data.map((r) => ({
    conversationId: r.conversation_id,
    other: {
      id: r.other_id,
      username: r.other_username,
      display_name: r.other_display_name,
      avatar_path: r.other_avatar_path ?? null,
    },
    lastBody: r.last_body,
    lastFromViewer: r.last_sender_id === viewerId,
    lastMessageAt: r.last_message_at,
    unread: r.unread,
  }));
}

/** How many DM threads have unread messages (0 when signed out). */
export async function getUnreadMessageCount(client: TypedClient): Promise<number> {
  const { data, error } = await client.rpc('unread_direct_count');
  if (error) throw error;
  return data ?? 0;
}

/** A page of messages, oldest first, ending just before `before` (or at the newest). */
export async function getMessages(
  client: TypedClient,
  conversationId: string,
  before: string | null = null,
): Promise<{ messages: MessageView[]; hasOlder: boolean }> {
  let query = client
    .from('messages')
    .select('id, sender_id, body, created_at')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: false })
    .limit(MESSAGE_PAGE_SIZE + 1);
  if (before) query = query.lt('created_at', before);
  const { data, error } = await query;
  if (error) throw error;
  return {
    messages: data
      .slice(0, MESSAGE_PAGE_SIZE)
      .reverse()
      .map((m) => ({ id: m.id, senderId: m.sender_id, body: m.body, createdAt: m.created_at })),
    hasOlder: data.length > MESSAGE_PAGE_SIZE,
  };
}

/** A DM thread the viewer is in, with the other person and the newest messages. Null if not found. */
export async function getConversation(
  client: TypedClient,
  conversationId: string,
  viewerId: string,
): Promise<ConversationView | null> {
  const { data: conv, error } = await client
    .from('conversations')
    .select('id, dm_low, dm_high')
    .eq('id', conversationId)
    .not('dm_low', 'is', null)
    .maybeSingle();
  if (error) throw error;
  if (!conv?.dm_low || !conv.dm_high) return null;
  const otherId = conv.dm_low === viewerId ? conv.dm_high : conv.dm_low;

  const [profile, block, page] = await Promise.all([
    client
      .from('profiles')
      .select('id, username, display_name, avatar_path')
      .eq('id', otherId)
      .maybeSingle(),
    client
      .from('blocks')
      .select('blocked_id')
      .eq('blocker_id', viewerId)
      .eq('blocked_id', otherId)
      .maybeSingle(),
    getMessages(client, conversationId),
  ]);
  if (profile.error) throw profile.error;
  if (block.error) throw block.error;
  if (!profile.data) return null;
  return { id: conv.id, other: profile.data, viewerBlocked: block.data !== null, ...page };
}
