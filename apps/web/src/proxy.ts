import type { NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/proxy';

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  // Everything except Next's build assets. No extension-based exclusions: a future /dealer/*.csv or
  // /account/*.txt route must still get the guard and session refresh.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
