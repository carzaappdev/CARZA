import { describe, expect, it } from 'vitest';
import { dealerNav, isActive, TAB_BAR } from './nav';

const activeLabels = (items: typeof TAB_BAR, pathname: string) =>
  items.filter((item) => isActive(item, pathname, items)).map((item) => item.label);

describe('isActive', () => {
  it('has exactly the three launch tabs', () => {
    expect(TAB_BAR.map((t) => t.label)).toEqual(['Feed', 'Reels', 'Events']);
  });

  it('marks Feed only on the exact root', () => {
    expect(activeLabels(TAB_BAR, '/')).toEqual(['Feed']);
    expect(activeLabels(TAB_BAR, '/events')).toEqual(['Events']);
    expect(activeLabels(TAB_BAR, '/p/123')).toEqual([]);
  });

  it('keeps the tab active on nested pages', () => {
    expect(activeLabels(TAB_BAR, '/events/abc')).toEqual(['Events']);
  });

  it('does not match on a shared prefix that is not a path segment', () => {
    expect(activeLabels(TAB_BAR, '/reelsy')).toEqual([]);
  });

  it('marks the dealer dashboard only on its root', () => {
    const nav = dealerNav('d1');
    expect(activeLabels(nav, '/dealer/d1')).toEqual(['Dashboard']);
    expect(activeLabels(nav, '/dealer/d1/inventory/import')).toEqual(['Inventory']);
  });
});
