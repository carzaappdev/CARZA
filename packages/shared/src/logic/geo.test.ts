import { describe, expect, it } from 'vitest';
import { distanceMiles, metersToMiles, milesToMeters } from './geo';

describe('unit conversion', () => {
  it('round-trips miles and meters', () => {
    expect(milesToMeters(1)).toBeCloseTo(1609.344);
    expect(metersToMiles(milesToMeters(25))).toBeCloseTo(25);
  });
});

describe('distanceMiles', () => {
  it('measures between two points', () => {
    // Austin to Dallas is about 182 miles as the crow flies.
    const austin = { lat: 30.2672, lng: -97.7431 };
    const dallas = { lat: 32.7767, lng: -96.797 };
    expect(distanceMiles(austin, dallas)).toBeGreaterThan(178);
    expect(distanceMiles(austin, dallas)).toBeLessThan(186);
    expect(distanceMiles(austin, austin)).toBe(0);
  });
});
