import { describe, expect, it } from 'vitest';
import { formatDistance, formatMileage, formatPrice, vehicleTitle } from './format';

describe('format', () => {
  it('formats prices in whole dollars', () => {
    expect(formatPrice(3_450_000)).toBe('$34,500');
    expect(formatPrice(99)).toBe('$1');
  });

  it('formats mileage and distance', () => {
    expect(formatMileage(41250)).toBe('41,250 mi');
    expect(formatDistance(500)).toBe('<1 mi');
    expect(formatDistance(19_312)).toBe('12 mi');
  });

  it('builds a vehicle title, skipping a missing trim', () => {
    expect(vehicleTitle({ year: 2019, make: 'Toyota', model: 'Tacoma', trim: 'TRD' })).toBe(
      '2019 Toyota Tacoma TRD',
    );
    expect(vehicleTitle({ year: 2019, make: 'Toyota', model: 'Tacoma', trim: null })).toBe(
      '2019 Toyota Tacoma',
    );
  });
});
