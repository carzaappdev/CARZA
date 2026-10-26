import { describe, expect, it } from 'vitest';
import { formatDistance, formatMileage, formatPrice, listedAgo, vehicleTitle } from './format';

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

describe('listedAgo', () => {
  const now = new Date('2026-10-25T12:00:00Z');
  it('describes how long a car has been listed', () => {
    expect(listedAgo('2026-10-25T08:00:00Z', now)).toBe('Listed today');
    expect(listedAgo('2026-10-24T08:00:00Z', now)).toBe('Listed yesterday');
    expect(listedAgo('2026-10-20T12:00:00Z', now)).toBe('Listed 5 days ago');
    expect(listedAgo('2026-10-04T12:00:00Z', now)).toBe('Listed 3 weeks ago');
    expect(listedAgo('2026-06-25T12:00:00Z', now)).toBe('Listed 4 months ago');
  });
});
