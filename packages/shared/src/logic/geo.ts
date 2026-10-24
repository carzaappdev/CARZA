export type LatLng = { lat: number; lng: number };

export const METERS_PER_MILE = 1609.344;

export const milesToMeters = (miles: number) => miles * METERS_PER_MILE;
export const metersToMiles = (meters: number) => meters / METERS_PER_MILE;

// Note: a private seller's public map point is approximated by the database (private.approximate_point,
// applied in the listings trigger), so there is exactly one implementation and the client can't skip it.
