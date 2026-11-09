import { NextResponse } from 'next/server';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/** Downloads everything Carza stores about the signed-in user, as JSON. Runs as the user (RLS applies). */
export async function GET() {
  const user = await getUser();
  if (!user) return NextResponse.json({ error: 'Sign in first.' }, { status: 401 });

  const supabase = await createClient();
  const uid = user.id;
  const sections = {
    profile: supabase.from('profiles').select('*').eq('id', uid).single(),
    privateProfile: supabase
      .from('profile_private')
      .select('postal_code, birth_date, terms_accepted_at, onboarded_at, updated_at')
      .eq('user_id', uid)
      .maybeSingle(),
    posts: supabase.from('posts').select('*').eq('author_id', uid).order('created_at'),
    postLikes: supabase.from('post_likes').select('*').eq('user_id', uid).order('created_at'),
    following: supabase.from('follows').select('followee_id, created_at').eq('follower_id', uid),
    followers: supabase.from('follows').select('follower_id, created_at').eq('followee_id', uid),
    events: supabase.from('events').select('*').eq('host_id', uid).order('created_at'),
    rsvps: supabase.from('event_rsvps').select('*').eq('user_id', uid).order('created_at'),
    reels: supabase.from('reels').select('*').eq('author_id', uid).order('created_at'),
    reelLikes: supabase.from('reel_likes').select('*').eq('user_id', uid).order('created_at'),
    garage: supabase.from('garage_cars').select('*').eq('owner_id', uid).order('created_at'),
    blocks: supabase.from('blocks').select('blocked_id, created_at').eq('blocker_id', uid),
    notifications: supabase
      .from('notifications')
      .select('*')
      .eq('user_id', uid)
      .order('created_at'),
  };
  const entries = await Promise.all(
    Object.entries(sections).map(async ([key, query]) => [key, await query] as const),
  );
  const failed = entries.find(([, r]) => r.error);
  if (failed) {
    console.error('export failed', {
      section: failed[0],
      code: failed[1].error?.code,
      userId: uid,
    });
    return NextResponse.json({ error: 'Couldn’t build your export. Try again.' }, { status: 500 });
  }

  const body = {
    exportedAt: new Date().toISOString(),
    account: { id: uid, email: user.email ?? null, createdAt: user.created_at },
    ...Object.fromEntries(entries.map(([key, r]) => [key, r.data])),
  };
  const date = new Date().toISOString().slice(0, 10);
  return new NextResponse(JSON.stringify(body, null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Content-Disposition': `attachment; filename="carza-data-${date}.json"`,
      'Cache-Control': 'private, no-store',
    },
  });
}
