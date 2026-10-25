import { describe, expect, it } from 'vitest';
import { parseSearchFilters, toSearchQuery } from '../schemas/search';
import { filterChips } from './search-chips';

describe('filterChips', () => {
  const f = parseSearchFilters({
    make: 'toyota',
    model: 'rav4',
    priceMax: '30000',
    yearMin: '2018',
    body: ['suv', 'crossover'],
    zip: '78701',
    radius: '25',
    sort: 'distance',
    page: '3',
  });
  const chips = filterChips(f, { make: 'Toyota', model: 'RAV4', place: '78701' });

  it('lists each active filter', () => {
    expect(chips.map((c) => c.label)).toEqual([
      'Within 25 mi of 78701',
      'Toyota',
      'RAV4',
      'Up to $30,000',
      '2018+',
      'SUV',
      'Crossover',
    ]);
  });

  it('removes one filter at a time and resets the page', () => {
    const remove = (key: string) => {
      const chip = chips.find((c) => c.key === key);
      if (!chip) throw new Error(key);
      return toSearchQuery(f, chip.remove);
    };
    expect(remove('body-suv')).toBe(
      'make=toyota&model=rav4&yearMin=2018&priceMax=30000&body=crossover&zip=78701&radius=25&sort=distance',
    );
    // Removing the make also removes its model; removing the location drops "closest first".
    expect(remove('make')).not.toContain('model=');
    expect(remove('location')).toBe(
      'make=toyota&model=rav4&yearMin=2018&priceMax=30000&body=suv&body=crossover',
    );
  });
});
