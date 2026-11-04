export type LatLng = { lat: number; lng: number };

export const METERS_PER_MILE = 1609.344;

export const milesToMeters = (miles: number) => miles * METERS_PER_MILE;
export const metersToMiles = (meters: number) => meters / METERS_PER_MILE;

// Note: a private seller's public map point is approximated by the database (private.approximate_point,
// applied in the listings trigger), so there is exactly one implementation and the client can't skip it.

/** Great-circle distance in miles. */
export function distanceMiles(a: LatLng, b: LatLng) {
  const rad = (d: number) => (d * Math.PI) / 180;
  const h =
    Math.sin(rad(b.lat - a.lat) / 2) ** 2 +
    Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(rad(b.lng - a.lng) / 2) ** 2;
  return 2 * 3958.8 * Math.asin(Math.min(1, Math.sqrt(h)));
}
