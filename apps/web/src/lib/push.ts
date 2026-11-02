import 'server-only';
import webpush, { WebPushError } from 'web-push';
import { describePush, notificationDataSchema } from '@carza/shared';
import { clientEnv } from '@/env/client';
import { serverEnv } from '@/env/server';
import { createAdminClient } from '@/lib/supabase/admin';

// Older than this, an alert is stale (e.g. the dispatch was retried late), so don't buzz the phone.
const MAX_AGE_MS = 10 * 60_000;

/** True when every key push needs is configured. */
export function pushConfigured() {
  return Boolean(
    clientEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
    serverEnv.VAPID_PRIVATE_KEY &&
    serverEnv.PUSH_DISPATCH_SECRET &&
    serverEnv.SUPABASE_SECRET_KEY,
  );
}

/**
 * Sends the push for one notification to every device its owner turned alerts on for, and forgets
 * devices the push service says are gone. Runs without a user session (the database calls it), which
 * is why it uses the secret-key client: it only reads the one notification, its actor's public name,
 * and the owner's devices.
 */
export async function sendNotificationPush(notificationId: string) {
  const admin = createAdminClient();
  const publicKey = clientEnv.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = serverEnv.VAPID_PRIVATE_KEY;
  if (!admin || !publicKey || !privateKey) return { sent: 0 };

  const { data: n } = await admin
    .from('notifications')
    .select('user_id, type, data, read_at, created_at')
    .eq('id', notificationId)
    .maybeSingle();
  if (!n || n.read_at || Date.now() - Date.parse(n.created_at) > MAX_AGE_MS) return { sent: 0 };

  const data = notificationDataSchema.parse(n.data);
  const [{ data: actor }, { data: devices }, { data: prefs }] = await Promise.all([
    data.actor_id
      ? admin
          .from('profiles')
          .select('username, display_name')
          .eq('id', data.actor_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    admin.from('push_subscriptions').select('id, endpoint, p256dh, auth').eq('user_id', n.user_id),
    admin.from('profile_private').select('push_muted').eq('user_id', n.user_id).maybeSingle(),
  ]);
  if (prefs?.push_muted.includes(n.type)) return { sent: 0 };
  const message = describePush(n.type, data, actor ?? null);
  if (!message || !devices?.length) return { sent: 0 };

  const payload = JSON.stringify(message);
  // Push services want a way to reach the sender: the site's https URL (local dev runs on http).
  const site = clientEnv.NEXT_PUBLIC_SITE_URL;
  const subject = site.startsWith('https://') ? site : 'mailto:push@localhost.invalid';
  const options = {
    vapidDetails: { subject, publicKey, privateKey },
    TTL: 60 * 60 * 24,
    urgency: 'normal' as const,
  };
  const gone: string[] = [];
  const results = await Promise.allSettled(
    devices.map((d) =>
      webpush
        .sendNotification(
          { endpoint: d.endpoint, keys: { p256dh: d.p256dh, auth: d.auth } },
          payload,
          options,
        )
        .catch((err: unknown) => {
          if (err instanceof WebPushError && (err.statusCode === 404 || err.statusCode === 410)) {
            gone.push(d.id);
          }
          throw err;
        }),
    ),
  );
  if (gone.length) await admin.from('push_subscriptions').delete().in('id', gone);
  const failed = results.filter((r) => r.status === 'rejected').length - gone.length;
  if (failed > 0) console.error('push delivery failed', { notificationId, failed });
  return { sent: results.length - failed - gone.length };
}
