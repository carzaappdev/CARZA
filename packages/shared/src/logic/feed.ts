type FeedItem = { id: string; createdAt: string; author: { id: string } };

/** How often an open feed checks for new posts. */
export const FEED_POLL_MS = 60_000;

/**
 * Posts in a freshly loaded first page that the reader hasn't seen: newer than anything on screen,
 * not already shown, and not their own (those go to the top as soon as they post). Newest first.
 */
export function newerPosts<T extends FeedItem>(shown: T[], fresh: T[], viewerId: string | null) {
  const seen = new Set(shown.map((p) => p.id));
  const newest = Math.max(0, ...shown.map((p) => Date.parse(p.createdAt)));
  return fresh
    .filter((p) => !seen.has(p.id) && p.author.id !== viewerId && Date.parse(p.createdAt) > newest)
    .sort((a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt));
}
