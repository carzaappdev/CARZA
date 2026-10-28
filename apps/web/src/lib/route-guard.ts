import { safeNextPath } from '@carza/shared';

const PROTECTED_PREFIXES = ['/account', '/dealer', '/notifications'];

/**
 * The launch app is Feed, Reels and Events only. The marketplace, selling and dealer areas stay in the
 * codebase but answer 404 until they're switched back on by removing them from this list.
 */
const HIDDEN_FOR_LAUNCH = [
  '/search',
  '/listings',
  '/dealers',
  '/dealer',
  '/account/listings',
  '/account/messages',
  '/account/saved',
  '/account/test-drives',
];

const under = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

/** Whether `pathname` belongs to an area that's switched off for launch. */
export function hiddenForLaunch(pathname: string) {
  return HIDDEN_FOR_LAUNCH.some((p) => under(pathname, p));
}

/**
 * Where (if anywhere) to send a signed-out request. Only ever redirects TO sign-in, never away from it:
 * the proxy's local JWT check can disagree with the Auth server (e.g. a session revoked on another
 * device), so bouncing "signed-in" users off /sign-in here would loop. Pages do that check server-side
 * with getUser() instead. Role/membership checks happen in layouts and actions, not here.
 */
export function routeRedirect(pathname: string, search: string, signedIn: boolean): string | null {
  if (!signedIn && PROTECTED_PREFIXES.some((p) => under(pathname, p))) {
    return `/sign-in?next=${encodeURIComponent(safeNextPath(pathname + search))}`;
  }
  return null;
}
