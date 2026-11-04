'use server';

import { getMessages, getUnreadMessageCount, type MessageView } from '@carza/db';
import {
  conversationIdSchema,
  fail,
  ok,
  messagePageSchema,
  sendMessageSchema,
  startConversationSchema,
  type ActionResult,
} from '@carza/shared';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/** Opens (or creates) the DM thread with someone. The database refuses blocked pairs. */
export async function startConversation(
  input: unknown,
): Promise<ActionResult<{ conversationId: string }>> {
  const parsed = startConversationSchema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION', 'That request wasn’t valid.');
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in to send messages.');
  if (parsed.data.userId === user.id) return fail('VALIDATION', 'You can’t message yourself.');

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('start_direct_conversation', {
    p_user_id: parsed.data.userId,
  });
  if (error || !data) {
    if (error?.code === 'CZ429')
      return fail('RATE_LIMITED', 'You’ve started a lot of conversations. Try again later.');
    if (error?.code === '42501') return fail('FORBIDDEN', 'You can’t message this account.');
    if (error?.code === 'P0002') return fail('NOT_FOUND', 'That account no longer exists.');
    console.error('startConversation failed', { code: error?.code, userId: user.id });
    return fail('INTERNAL', 'Couldn’t open the conversation. Try again.');
  }
  return ok({ conversationId: data });
}

export async function sendMessage(input: unknown): Promise<ActionResult<MessageView>> {
  const parsed = sendMessageSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION', parsed.error.issues[0]?.message ?? 'That message isn’t valid.');
  }
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in to send messages.');

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('messages')
    .insert({ conversation_id: parsed.data.conversationId, body: parsed.data.body })
    .select('id, sender_id, body, created_at')
    .single();
  if (error) {
    if (error.code === 'CZ429')
      return fail('RATE_LIMITED', 'You’re sending messages too fast. Wait a moment.');
    if (error.code === '42501') return fail('FORBIDDEN', 'You can’t message this account.');
    console.error('sendMessage failed', { code: error.code, userId: user.id });
    return fail('INTERNAL', 'Couldn’t send. Try again.');
  }
  return ok({ id: data.id, senderId: data.sender_id, body: data.body, createdAt: data.created_at });
}

/** Clears the thread's unread state for the viewer. */
export async function markConversationRead(input: unknown): Promise<ActionResult<null>> {
  const parsed = conversationIdSchema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION', 'That request wasn’t valid.');
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in first.');
  const supabase = await createClient();
  const { error } = await supabase.rpc('mark_conversation_read', {
    p_conversation_id: parsed.data.conversationId,
  });
  if (error) {
    if (error.code === 'P0002') return fail('NOT_FOUND', 'That conversation isn’t available.');
    console.error('markConversationRead failed', { code: error.code, userId: user.id });
    return fail('INTERNAL', 'Couldn’t update.');
  }
  return ok(null);
}

/** A page of messages: before a given time, or the newest. RLS limits it to the viewer's threads. */
export async function loadMessages(
  input: unknown,
): Promise<ActionResult<{ messages: MessageView[]; hasOlder: boolean }>> {
  const parsed = messagePageSchema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION', 'That request wasn’t valid.');
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in first.');
  try {
    return ok(
      await getMessages(await createClient(), parsed.data.conversationId, parsed.data.before),
    );
  } catch {
    return fail('INTERNAL', 'Couldn’t load messages.');
  }
}

/** For the inbox badge. 0 when signed out. */
export async function unreadMessageCount(): Promise<ActionResult<{ count: number }>> {
  const user = await getUser();
  if (!user) return ok({ count: 0 });
  try {
    return ok({ count: await getUnreadMessageCount(await createClient()) });
  } catch {
    return fail('INTERNAL', 'Couldn’t load messages.');
  }
}
