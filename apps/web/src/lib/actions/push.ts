'use server';

import {
  fail,
  mutedPushTypes,
  ok,
  pushPreferencesSchema,
  pushSubscriptionSchema,
  type ActionResult,
} from '@carza/shared';
import { z } from 'zod';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/** Turns push on for this browser: saves its subscription for the signed-in user. */
export async function savePushSubscription(input: unknown): Promise<ActionResult<null>> {
  const parsed = pushSubscriptionSchema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION', 'This browser’s push setup wasn’t valid.');
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in to turn on alerts.');

  const { endpoint, keys } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase.rpc('save_push_subscription', {
    p_endpoint: endpoint,
    p_p256dh: keys.p256dh,
    p_auth: keys.auth,
  });
  if (error) {
    console.error('savePushSubscription failed', { code: error.code, userId: user.id });
    return fail('INTERNAL', 'Couldn’t turn on alerts. Try again.');
  }
  return ok(null);
}

const endpointSchema = z.url().max(1000);

/** Turns push off for this browser. RLS limits the delete to the viewer's own devices. */
export async function removePushSubscription(endpoint: unknown): Promise<ActionResult<null>> {
  const parsed = endpointSchema.safeParse(endpoint);
  if (!parsed.success) return fail('VALIDATION', 'That request wasn’t valid.');
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in first.');

  const supabase = await createClient();
  const { error } = await supabase
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)
    .eq('endpoint', parsed.data);
  if (error) {
    console.error('removePushSubscription failed', { code: error.code, userId: user.id });
    return fail('INTERNAL', 'Couldn’t turn off alerts. Try again.');
  }
  return ok(null);
}

/** Saves which kinds of alerts the user muted (they still show in the app). */
export async function savePushPreferences(input: unknown): Promise<ActionResult<null>> {
  const parsed = pushPreferencesSchema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION', 'That request wasn’t valid.');
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in first.');

  const supabase = await createClient();
  const { error } = await supabase
    .from('profile_private')
    .update({ push_muted: mutedPushTypes(parsed.data.muted) })
    .eq('user_id', user.id);
  if (error) {
    console.error('savePushPreferences failed', { code: error.code, userId: user.id });
    return fail('INTERNAL', 'Couldn’t save your alert settings. Try again.');
  }
  return ok(null);
}
