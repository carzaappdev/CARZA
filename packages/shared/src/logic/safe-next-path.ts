/**
 * Returns `next` only if it is a same-origin relative path, otherwise `fallback`.
 * Used for every `?next=` redirect and OAuth `redirectTo` to prevent open redirects.
 */
export function safeNextPath(next: string | null | undefined, fallback = '/'): string {
  if (!next) return fallback;
  // Reject control characters (e.g. "/\t/evil.com" is normalized by browsers to "//evil.com").
  if (/[\u0000-\u001f\u007f]/.test(next)) return fallback;
  if (!isSafeRelative(next)) return fallback;
  try {
    const base = 'https://carza.invalid';
    const url = new URL(next, base);
    if (url.origin !== base) return fallback;
    const normalized = url.pathname + url.search + url.hash;
    // Check again AFTER normalization: dot-segments like "/.//evil.com" collapse to "//evil.com".
    return isSafeRelative(normalized) ? normalized : fallback;
  } catch {
    return fallback;
  }
}

// Exactly one leading "/" and not protocol-relative ("//x") or a backslash trick ("/\x").
const isSafeRelative = (path: string) =>
  path.startsWith('/') && !path.startsWith('//') && !path.startsWith('/\\');
