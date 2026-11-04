import 'server-only';
import { cache } from 'react';
import webpush, { WebPushError } from 'web-push';
import { describePush, notificationDataSchema } from '@carza/shared';
import { clientEnv } from '@/env/client';
import { createAdminClient } from '@/lib/supabase/admin';

// Older than this, an alert is stale (e.g. the dispatch ran late), so don't buzz the phone.
const MAX_AGE_MS = 10 * 60_000;

/**
 * The server's VAPID keys. Generated on first use and stored in a table only the secret-key client can
 * read, so nobody has to create or copy keys by hand. Null when the secret key isn't configured.
 */
const vapidKeys = cache(async () => {
  const admin = createAdminClient();
  if (!admin) return null;
  const read = () =>
    admin.from('push_vapid_keys').select('public_key, private_key').eq('id', 1).maybeSingle();
  const { data } = await read();
  if (data) return data;
  const fresh = webpush.generateVAPIDKeys();
  // If two servers race, the first insert wins and both read it back.
  await admin
    .from('push_vapid_keys')
    .upsert(
      { id: 1, public_key: fresh.publicKey, private_key: fresh.privateKey },
      { onConflict: 'id', ignoreDuplicates: true },
    );
  return (await read()).data;
});

/** The public key browsers subscribe with, or null when push isn't available on this deployment. */
export async function vapidPublicKey() {
  return (await vapidKeys().catch(() => null))?.public_key ?? null;
}

/**
 * Sends the push for one notification to every device its owner turned alerts on for, and forgets
 * devices the push service says are gone. The database calls this with no user session, which is why
 * it uses the secret-key client. It first claims the notification (pushed_at, once, only while fresh
 * and unread), so repeated or forged calls can't send anything twice or to anyone but the owner.
 */
export async function sendNotificationPush(notificationId: string) {
  const admin = createAdminClient();
  const keys = await vapidKeys();
  if (!admin || !keys) return { sent: 0 };

  const { data: n } = await admin
    .from('notifications')
    .update({ pushed_at: new Date().toISOString() })
    .eq('id', notificationId)
    .is('pushed_at', null)
    .is('read_at', null)
    .gt('created_at', new Date(Date.now() - MAX_AGE_MS).toISOString())
    .select('user_id, type, data')
    .maybeSingle();
  if (!n) return { sent: 0 };

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
    vapidDetails: { subject, publicKey: keys.public_key, privateKey: keys.private_key },
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
