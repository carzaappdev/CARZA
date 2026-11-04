import { describe, expect, it } from 'vitest';
import { dealerNav, isActive, isReelPlayer, TAB_BAR } from './nav';

const activeLabels = (items: typeof TAB_BAR, pathname: string) =>
  items.filter((item) => isActive(item, pathname, items)).map((item) => item.label);

describe('isActive', () => {
  it('has the four main tabs', () => {
    expect(TAB_BAR.map((t) => t.label)).toEqual(['Feed', 'Reels', 'Events', 'Garage']);
  });

  it('marks Garage on your garage pages but not on a public car page', () => {
    expect(activeLabels(TAB_BAR, '/account/garage')).toEqual(['Garage']);
    expect(activeLabels(TAB_BAR, '/account/garage/new')).toEqual(['Garage']);
    expect(activeLabels(TAB_BAR, '/garage/abc')).toEqual([]);
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

describe('isReelPlayer', () => {
  it('is true on the reels feed and a single reel, not the uploader', () => {
    expect(isReelPlayer('/reels')).toBe(true);
    expect(isReelPlayer('/reels/0b5c9a1e-1f2d-4c3b-9a8e-7d6c5b4a3f21')).toBe(true);
    expect(isReelPlayer('/reels/new')).toBe(false);
    expect(isReelPlayer('/')).toBe(false);
    expect(isReelPlayer('/events')).toBe(false);
  });
});
