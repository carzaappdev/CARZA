import { safeNextPath } from '@carza/shared';

const PROTECTED_PREFIXES = ['/account', '/dealer'];
const GUEST_ONLY = ['/sign-in', '/sign-up'];

const matches = (pathname: string, prefix: string) =>
  pathname === prefix || pathname.startsWith(`${prefix}/`);

/**
 * Where (if anywhere) to redirect a request, based only on whether the user is signed in.
 * Role/membership checks happen in layouts and actions, not here (no DB call per request).
 */
export function routeRedirect(pathname: string, search: string, signedIn: boolean): string | null {
  if (!signedIn && PROTECTED_PREFIXES.some((p) => matches(pathname, p))) {
    return `/sign-in?next=${encodeURIComponent(safeNextPath(pathname + search))}`;
  }
  if (signedIn && GUEST_ONLY.some((p) => matches(pathname, p))) {
    const next = new URLSearchParams(search).get('next');
    return safeNextPath(next);
  }
  return null;
}
