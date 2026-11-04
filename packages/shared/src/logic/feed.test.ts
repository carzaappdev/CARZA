import { describe, expect, it } from 'vitest';
import { newerPosts } from './feed';

const post = (id: string, createdAt: string, author = 'a') => ({
  id,
  createdAt,
  author: { id: author },
});

describe('newerPosts', () => {
  const shown = [post('1', '2026-11-02T10:00:00Z'), post('2', '2026-11-02T09:00:00Z')];

  it('finds posts newer than everything on screen', () => {
    const fresh = [post('3', '2026-11-02T11:00:00Z'), ...shown];
    expect(newerPosts(shown, fresh, null).map((p) => p.id)).toEqual(['3']);
  });

  it('ignores older posts a ranked feed moved up, and ones already shown', () => {
    const fresh = [post('2', '2026-11-02T09:00:00Z'), post('0', '2026-11-01T09:00:00Z')];
    expect(newerPosts(shown, fresh, null)).toEqual([]);
  });

  it('ignores the reader’s own posts', () => {
    expect(newerPosts(shown, [post('4', '2026-11-02T12:00:00Z', 'me')], 'me')).toEqual([]);
  });

  it('counts everything on an empty feed', () => {
    expect(newerPosts([], [post('5', '2026-11-02T12:00:00Z')], null)).toHaveLength(1);
  });
});
