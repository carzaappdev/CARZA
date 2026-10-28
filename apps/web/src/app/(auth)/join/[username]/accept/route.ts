import { type NextRequest, NextResponse } from 'next/server';
import { INVITE_COOKIE, validUsername } from '@/lib/invites';

/** Remember the invite, then go create an account. Setup (/welcome) follows the inviter. */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ username: string }> },
) {
  const { username } = await params;
  const response = NextResponse.redirect(new URL('/sign-up', request.url));
  if (validUsername(username)) {
    response.cookies.set(INVITE_COOKIE, username, {
      httpOnly: true,
      sameSite: 'lax',
      secure: request.nextUrl.protocol === 'https:',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });
  }
  return response;
}
