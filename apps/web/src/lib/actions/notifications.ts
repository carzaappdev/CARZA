'use server';

import { getUnreadCount } from '@carza/db';
import { fail, ok, type ActionResult } from '@carza/shared';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

/** For the bell's badge. 0 when signed out. */
export async function unreadNotificationCount(): Promise<ActionResult<{ count: number }>> {
  const user = await getUser();
  if (!user) return ok({ count: 0 });
  try {
    return ok({ count: await getUnreadCount(await createClient()) });
  } catch {
    return fail('INTERNAL', 'Couldn’t load notifications.');
  }
}

/** Marks everything read (RLS limits it to the viewer's own rows). */
export async function markNotificationsRead(): Promise<ActionResult<null>> {
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in first.');
  const supabase = await createClient();
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null);
  if (error) {
    console.error('markNotificationsRead failed', { code: error.code, userId: user.id });
    return fail('INTERNAL', 'Couldn’t update notifications.');
  }
  return ok(null);
}
