import { describe, expect, it } from 'vitest';
import { carTags, carTitle, partSearchUrl } from './garage';

describe('carTitle', () => {
  it('adds the trim when there is one', () => {
    expect(carTitle({ year: 2019, make: 'Mazda', model: 'MX-5 Miata', trimLevel: 'Club' })).toBe(
      '2019 Mazda MX-5 Miata Club',
    );
    expect(carTitle({ year: 2019, make: 'Subaru', model: 'WRX', trimLevel: null })).toBe(
      '2019 Subaru WRX',
    );
  });
});

describe('carTags', () => {
  it('squashes names into valid tags', () => {
    expect(carTags('Mazda', 'MX-5 Miata')).toEqual(['mx5miata', 'mazdamx5miata', 'miata']);
    expect(carTags('Jeep', 'Grand Cherokee')).toEqual([
      'grandcherokee',
      'jeepgrandcherokee',
      'cherokee',
    ]);
    expect(carTags('Ford', 'F-150')).toEqual(['f150', 'fordf150']);
  });
  it('drops tags that would start with a digit', () => {
    expect(carTags('Toyota', '86')).toEqual(['toyota86']);
    expect(carTags('BMW', '3 Series')).toEqual(['bmw3series']);
    expect(carTags('Tesla', 'Model 3')).toEqual(['model3', 'teslamodel3']);
  });
});

describe('partSearchUrl', () => {
  it('searches for the part on the exact car', () => {
    expect(partSearchUrl({ year: 2020, make: 'Jeep', model: 'Wrangler' }, 'Brake pads')).toBe(
      'https://www.google.com/search?tbm=shop&q=2020%20Jeep%20Wrangler%20Brake%20pads',
    );
  });
});
