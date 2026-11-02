import { timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { serverEnv } from '@/env/server';
import { pushConfigured, sendNotificationPush } from '@/lib/push';

const bodySchema = z.object({ notification_id: z.guid() });

function authorized(header: string | null) {
  const secret = serverEnv.PUSH_DISPATCH_SECRET;
  if (!secret || !header) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return given.length === expected.length && timingSafeEqual(given, expected);
}

/**
 * Called by the database (pg_net) when a notification is created; never by browsers. The shared
 * secret proves the caller, and the route only ever sends the stored notification to its own owner.
 */
export async function POST(request: Request) {
  if (!pushConfigured() || !authorized(request.headers.get('authorization'))) {
    return new Response(null, { status: 401 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return new Response(null, { status: 400 });
  const result = await sendNotificationPush(parsed.data.notification_id);
  return Response.json(result);
}
