/**
 * @mentions and #tags in post text. The database extracts them with the same rules (see the
 * feed_mentions_tags migration), so keep the two in sync.
 */
export type TextSegment =
  | { type: 'text'; value: string }
  | { type: 'mention'; value: string; username: string }
  | { type: 'tag'; value: string; tag: string };

// A mention or tag must start the text or follow a character that can't be part of a word.
const TOKEN = /(^|[^A-Za-z0-9_])(@[A-Za-z0-9_]{3,30}|#[A-Za-z][A-Za-z0-9_]{1,29})(?![A-Za-z0-9_])/g;

export function splitRichText(text: string): TextSegment[] {
  const out: TextSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(TOKEN)) {
    const lead = m[1] ?? '';
    const token = m[2] ?? '';
    const start = (m.index ?? 0) + lead.length;
    if (start > last) out.push({ type: 'text', value: text.slice(last, start) });
    out.push(
      token.startsWith('@')
        ? { type: 'mention', value: token, username: token.slice(1).toLowerCase() }
        : { type: 'tag', value: token, tag: token.slice(1).toLowerCase() },
    );
    last = start + token.length;
  }
  if (last < text.length) out.push({ type: 'text', value: text.slice(last) });
  return out;
}

/** Distinct lowercase tags, in order of first use. */
export const extractTags = (text: string) => [
  ...new Set(splitRichText(text).flatMap((s) => (s.type === 'tag' ? [s.tag] : []))),
];

/** A tag from a URL or search box: "#E46" → "e46"; null if it isn't a valid tag. */
export function normalizeTag(input: string) {
  const tag = input.trim().replace(/^#/, '').toLowerCase();
  return /^[a-z][a-z0-9_]{1,29}$/.test(tag) ? tag : null;
}
