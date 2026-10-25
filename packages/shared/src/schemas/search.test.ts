import { describe, expect, it } from 'vitest';
import { SEARCH_MAX_PAGE, parseSearchFilters, toSearchArgs, toSearchQuery } from './search';

describe('parseSearchFilters', () => {
  it('parses URL params', () => {
    const f = parseSearchFilters({
      make: 'toyota',
      priceMax: '30000',
      body: ['suv', 'pickup'],
      fuel: 'hybrid,electric',
      lat: '30.27',
      lng: '-97.74',
      sort: 'price_asc',
      page: '2',
    });
    expect(f).toMatchObject({
      make: 'toyota',
      priceMax: 30000,
      body: ['suv', 'pickup'],
      fuel: ['hybrid', 'electric'],
      lat: 30.27,
      lng: -97.74,
      sort: 'price_asc',
      page: 2,
    });
  });

  it('drops bad values instead of failing', () => {
    const f = parseSearchFilters({
      make: 'Toyota; drop table',
      priceMax: 'cheap',
      yearMin: '1066',
      body: ['spaceship', 'suv', 'suv'],
      sort: 'random',
      page: String(SEARCH_MAX_PAGE + 1),
      lat: '91',
      mileageMax: '',
    });
    expect(f).toEqual(
      expect.objectContaining({
        make: undefined,
        priceMax: undefined,
        yearMin: undefined,
        body: ['suv'],
        sort: undefined,
        page: undefined,
        lat: undefined,
        mileageMax: undefined,
      }),
    );
  });

  it('takes the first of repeated single-value keys', () => {
    expect(parseSearchFilters({ make: ['ford', 'kia'] }).make).toBe('ford');
  });
});

describe('toSearchArgs', () => {
  it('converts dollars to cents and pages to offsets', () => {
    const args = toSearchArgs(
      parseSearchFilters({ priceMin: '5000', priceMax: '20000', page: '3' }),
      {
        makeId: 7,
      },
    );
    expect(args).toMatchObject({
      p_make_id: 7,
      p_price_min_cents: 500000,
      p_price_max_cents: 2000000,
      p_offset: 48,
      p_limit: 24,
    });
  });

  it('only searches by distance when both coordinates are present', () => {
    const noLng = toSearchArgs(parseSearchFilters({ lat: '30', sort: 'distance' }));
    expect(noLng).toMatchObject({ p_lat: undefined, p_lng: undefined, p_sort: 'newest' });
    const located = toSearchArgs(parseSearchFilters({ lat: '30', lng: '-97', sort: 'distance' }));
    expect(located).toMatchObject({
      p_lat: 30,
      p_lng: -97,
      p_sort: 'distance',
      p_radius_miles: 50,
    });
  });
});

describe('toSearchQuery', () => {
  it('builds a canonical query string without defaults', () => {
    const f = parseSearchFilters({ sort: 'newest', page: '1', body: ['suv', 'van'], make: 'kia' });
    expect(toSearchQuery(f)).toBe('make=kia&body=suv&body=van');
  });

  it('applies a patch', () => {
    const f = parseSearchFilters({ make: 'kia', model: 'telluride', page: '4' });
    expect(toSearchQuery(f, { model: undefined, page: undefined })).toBe('make=kia');
  });
});
