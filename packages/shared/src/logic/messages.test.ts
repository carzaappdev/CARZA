import { describe, expect, it } from 'vitest';
import { formatMessageDivider, layoutMessages } from './messages';

const at = (minutes: number) => new Date(Date.UTC(2026, 10, 2, 12, minutes)).toISOString();
const msg = (id: string, senderId: string, minutes: number) => ({
  id,
  senderId,
  createdAt: at(minutes),
});

describe('layoutMessages', () => {
  it('groups quick runs from one person and splits on a new sender', () => {
    const layout = layoutMessages([msg('1', 'a', 0), msg('2', 'a', 1), msg('3', 'b', 2)]);
    expect(
      layout.map(({ divider, groupStart, groupEnd }) => ({ divider, groupStart, groupEnd })),
    ).toEqual([
      { divider: true, groupStart: true, groupEnd: false },
      { divider: false, groupStart: false, groupEnd: true },
      { divider: false, groupStart: true, groupEnd: true },
    ]);
  });

  it('splits a run after a five minute pause', () => {
    const layout = layoutMessages([msg('1', 'a', 0), msg('2', 'a', 6)]);
    expect(layout.map((l) => [l.groupStart, l.groupEnd])).toEqual([
      [true, true],
      [true, true],
    ]);
  });

  it('adds a time divider after an hour', () => {
    const layout = layoutMessages([msg('1', 'a', 0), msg('2', 'b', 61)]);
    expect(layout.map((l) => l.divider)).toEqual([true, true]);
  });

  it('handles an empty thread', () => {
    expect(layoutMessages([])).toEqual([]);
  });
});

describe('formatMessageDivider', () => {
  const now = new Date(2026, 10, 5, 18, 0);
  it('says today, yesterday, weekday, then the date', () => {
    expect(formatMessageDivider(new Date(2026, 10, 5, 15, 4).toISOString(), now)).toBe(
      'Today 3:04 PM',
    );
    expect(formatMessageDivider(new Date(2026, 10, 4, 9, 12).toISOString(), now)).toBe(
      'Yesterday 9:12 AM',
    );
    expect(formatMessageDivider(new Date(2026, 10, 2, 9, 12).toISOString(), now)).toMatch(
      /^Mon 9:12 AM$/,
    );
    expect(formatMessageDivider(new Date(2026, 2, 4, 9, 12).toISOString(), now)).toBe(
      'Mar 4, 9:12 AM',
    );
  });
});
