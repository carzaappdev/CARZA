import { safeNextPath } from '@carza/shared';

const PROTECTED_PREFIXES = ['/account', '/dealer'];

const matches = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

/**
 * Where (if anywhere) to send a signed-out request. Only ever redirects TO sign-in, never away from it:
 * the proxy's local JWT check can disagree with the Auth server (e.g. a session revoked on another
 * device), so bouncing "signed-in" users off /sign-in here would loop. Pages do that check server-side
 * with getUser() instead. Role/membership checks happen in layouts and actions, not here.
 */
export function routeRedirect(pathname: string, search: string, signedIn: boolean): string | null {
  if (!signedIn && PROTECTED_PREFIXES.some((p) => matches(pathname, p))) {
    return `/sign-in?next=${encodeURIComponent(safeNextPath(pathname + search))}`;
  }
  return null;
}
