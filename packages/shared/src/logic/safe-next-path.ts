/**
 * Returns `next` only if it is a same-origin relative path, otherwise `fallback`.
 * Used for every `?next=` redirect and OAuth `redirectTo` to prevent open redirects.
 */
export function safeNextPath(next: string | null | undefined, fallback = '/'): string {
  if (!next) return fallback;
  // Must start with exactly one "/" and not be protocol-relative ("//x") or a backslash trick ("/\x").
  if (!next.startsWith('/') || next.startsWith('//') || next.startsWith('/\\')) return fallback;
  // Reject control characters (e.g. "/\t/evil.com" is normalized by some browsers to "//evil.com").
  if (/[\u0000-\u001f\u007f]/.test(next)) return fallback;
  try {
    const base = 'https://carza.invalid';
    const url = new URL(next, base);
    if (url.origin !== base) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
