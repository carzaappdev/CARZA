import { z } from 'zod';
import { sendNotificationPush } from '@/lib/push';

const bodySchema = z.object({ notification_id: z.guid() });

/**
 * Called by the database (pg_net) right after a notification is created. Needs no secret: it only
 * ever sends a stored, fresh, unread notification to its own owner, at most once (see
 * sendNotificationPush), so calling it again or with a guessed id does nothing.
 */
export async function POST(request: Request) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: 400 });
  return Response.json(await sendNotificationPush(parsed.data.notification_id));
}
