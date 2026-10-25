import { NextResponse, type NextRequest } from 'next/server';
import { safeNextPath } from '@carza/shared';
import { createClient } from '@/lib/supabase/server';

/** OAuth (PKCE) return: exchange the code for a session, then go to the validated `next` path. */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const next = safeNextPath(searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  // Provider errors (e.g. the user cancelled) and bad codes all land here, with fixed copy only.
  return NextResponse.redirect(
    new URL(`/sign-in?error=oauth_failed&next=${encodeURIComponent(next)}`, request.url),
  );
}
