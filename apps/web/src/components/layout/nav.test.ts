import { describe, expect, it } from 'vitest';
import { ACCOUNT_NAV, dealerNav, isActive, TAB_BAR } from './nav';

const activeLabels = (items: typeof TAB_BAR, pathname: string) =>
  items.filter((item) => isActive(item, pathname, items)).map((item) => item.label);

describe('isActive', () => {
  it('marks Home only on the exact root', () => {
    expect(activeLabels(TAB_BAR, '/')).toEqual(['Home']);
    expect(activeLabels(TAB_BAR, '/search')).toEqual(['Search']);
  });

  it('prefers the most specific tab when two match', () => {
    expect(activeLabels(TAB_BAR, '/account/listings/new')).toEqual(['Sell']);
    expect(activeLabels(TAB_BAR, '/account/messages/abc')).toEqual(['Messages']);
    expect(activeLabels(TAB_BAR, '/account/saved')).toEqual(['Account']);
  });

  it('does not match on a shared prefix that is not a path segment', () => {
    expect(activeLabels(TAB_BAR, '/searchable')).toEqual([]);
  });

  it('keeps the parent section active on nested pages', () => {
    expect(activeLabels(ACCOUNT_NAV, '/account/listings/new')).toEqual(['Your listings']);
  });

  it('marks the dealer dashboard only on its root', () => {
    const nav = dealerNav('d1');
    expect(activeLabels(nav, '/dealer/d1')).toEqual(['Dashboard']);
    expect(activeLabels(nav, '/dealer/d1/inventory/import')).toEqual(['Inventory']);
  });
});
