import { describe, expect, it } from 'vitest';
import { formatCount, formatRelativeTime } from './time';

const now = new Date('2026-10-27T12:00:00Z');
const ago = (s: number) => new Date(now.getTime() - s * 1000).toISOString();

describe('formatRelativeTime', () => {
  it('rounds down into the largest unit under a week', () => {
    expect(formatRelativeTime(ago(5), now)).toBe('now');
    expect(formatRelativeTime(ago(5 * 60), now)).toBe('5m');
    expect(formatRelativeTime(ago(3 * 3600 + 59), now)).toBe('3h');
    expect(formatRelativeTime(ago(2 * 86400), now)).toBe('2d');
  });

  it('shows a date after a week, with the year only when it differs', () => {
    expect(formatRelativeTime('2026-03-04T12:00:00Z', now)).toBe('Mar 4');
    expect(formatRelativeTime('2025-03-04T12:00:00Z', now)).toBe('Mar 4, 2025');
  });

  it('treats clock skew (future times) as now', () => {
    expect(formatRelativeTime(ago(-30), now)).toBe('now');
  });
});

describe('formatCount', () => {
  it('compacts large numbers', () => {
    expect(formatCount(950)).toBe('950');
    expect(formatCount(1200)).toBe('1.2K');
  });
});
