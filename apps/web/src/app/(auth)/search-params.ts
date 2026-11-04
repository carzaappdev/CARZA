import { AUTH_ERROR_CODES, authErrorMessage, safeNextPath } from '@carza/shared';

export type AuthSearchParams = Promise<{ next?: string | string[]; error?: string | string[] }>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** `next` is reduced to a same-origin path; `error` is mapped to fixed copy (never reflected as-is). */
export async function readAuthParams(searchParams: AuthSearchParams) {
  const params = await searchParams;
  const error = first(params.error);
  // Only codes our own routes emit show a banner; anything else in the URL is ignored.
  const known = error && AUTH_ERROR_CODES.includes(error) ? error : null;
  return {
    next: safeNextPath(first(params.next)),
    error: known ? authErrorMessage(known) : null,
    // Not every banner is bad news (e.g. "your email is confirmed, sign in").
    tone: known === 'email_confirmed' ? ('success' as const) : ('error' as const),
  };
}
