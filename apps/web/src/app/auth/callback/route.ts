import { NextResponse, type NextRequest } from 'next/server';
import { safeNextPath } from '@carza/shared';
import { createClient } from '@/lib/supabase/server';

/**
 * PKCE return for OAuth and for email links (sign-up confirmation, password reset; those add `flow=email`):
 * exchange the code for a session, then go to the validated `next` path.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get('code');
  const next = safeNextPath(searchParams.get('next'));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
  }
  // Fixed copy only. For email links: Supabase adds `error_code` when the link expired or was used;
  // otherwise the code couldn't be exchanged because the link was opened in a different browser
  // (no PKCE verifier cookie). A sign-up is already confirmed by then, so the person can just sign in.
  const error =
    searchParams.get('flow') !== 'email'
      ? 'oauth_failed'
      : searchParams.has('error_code')
        ? 'link_invalid'
        : 'link_other_browser';
  return NextResponse.redirect(
    new URL(`/sign-in?error=${error}&next=${encodeURIComponent(next)}`, request.url),
  );
}
