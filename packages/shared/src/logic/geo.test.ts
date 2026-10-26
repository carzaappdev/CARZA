import { describe, expect, it } from 'vitest';
import { metersToMiles, milesToMeters } from './geo';

describe('unit conversion', () => {
  it('round-trips miles and meters', () => {
    expect(milesToMeters(1)).toBeCloseTo(1609.344);
    expect(metersToMiles(milesToMeters(25))).toBeCloseTo(25);
  });
});
