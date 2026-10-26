import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import type { Database } from '@carza/db';
import { clientEnv } from '@/env/client';
import { SESSION_COOKIE_OPTIONS } from './cookie-options';
import { routeRedirect } from '@/lib/route-guard';

/**
 * Refreshes the auth session cookie on every request and applies the signed-in route guard.
 * Follows Supabase's @supabase/ssr pattern: nothing may run between createServerClient and getClaims().
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });
  // Headers Supabase asks us to set alongside refreshed cookies (e.g. Cache-Control: no-store).
  let sessionHeaders: Record<string, string> = {};

  const supabase = createServerClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookieOptions: SESSION_COOKIE_OPTIONS,
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          sessionHeaders = headers;
          Object.entries(headers).forEach(([key, value]) => response.headers.set(key, value));
        },
      },
    },
  );

  // Verifies the JWT (signature + expiry) and refreshes it if needed. Do not remove.
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);

  const target = routeRedirect(request.nextUrl.pathname, request.nextUrl.search, signedIn);
  if (target) {
    const redirect = NextResponse.redirect(new URL(target, request.url));
    // Keep any refreshed session cookies (and their cache headers) on the redirect.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    Object.entries(sessionHeaders).forEach(([key, value]) => redirect.headers.set(key, value));
    return redirect;
  }
  return response;
}
