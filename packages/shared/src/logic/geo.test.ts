import { describe, expect, it } from 'vitest';
import { approximatePoint, metersToMiles, milesToMeters } from './geo';

describe('approximatePoint', () => {
  it('snaps to a grid cell no more than ~1.1 km from the real point', () => {
    const real = { lat: 30.26716, lng: -97.74306 };
    const approx = approximatePoint(real);
    const dLatKm = Math.abs(approx.lat - real.lat) * 110.574;
    const dLngKm = Math.abs(approx.lng - real.lng) * 111.32 * Math.cos((real.lat * Math.PI) / 180);
    expect(Math.hypot(dLatKm, dLngKm)).toBeLessThan(1.1);
    expect(approx).not.toEqual(real);
  });

  it('is deterministic and maps nearby points to the same cell', () => {
    expect(approximatePoint({ lat: 30.2671, lng: -97.743 })).toEqual(
      approximatePoint({ lat: 30.2672, lng: -97.7431 }),
    );
  });
});

describe('unit conversion', () => {
  it('round-trips miles and meters', () => {
    expect(milesToMeters(1)).toBeCloseTo(1609.344);
    expect(metersToMiles(milesToMeters(25))).toBeCloseTo(25);
  });
});
