import { authErrorMessage, safeNextPath } from '@carza/shared';

export type AuthSearchParams = Promise<{ next?: string | string[]; error?: string | string[] }>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** `next` is reduced to a same-origin path; `error` is mapped to fixed copy (never reflected as-is). */
export async function readAuthParams(searchParams: AuthSearchParams) {
  const params = await searchParams;
  const error = first(params.error);
  return { next: safeNextPath(first(params.next)), error: error ? authErrorMessage(error) : null };
}
