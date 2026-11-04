import { z } from 'zod';
import { LIMITS } from '../constants/limits';

export const startConversationSchema = z.object({ userId: z.guid() });

export const sendMessageSchema = z.object({
  conversationId: z.guid(),
  body: z
    .string()
    .trim()
    .min(1, 'Write a message first.')
    .max(LIMITS.messageMaxLength, 'Messages can be up to 4,000 characters.'),
});
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export const conversationIdSchema = z.object({ conversationId: z.guid() });

/** A page of a thread: the messages before this time, or the newest when null. */
export const messagePageSchema = z.object({
  conversationId: z.guid(),
  before: z.iso.datetime({ offset: true }).nullable(),
});
