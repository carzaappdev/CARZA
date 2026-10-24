export type LatLng = { lat: number; lng: number };

export const METERS_PER_MILE = 1609.344;

export const milesToMeters = (miles: number) => miles * METERS_PER_MILE;
export const metersToMiles = (meters: number) => meters / METERS_PER_MILE;

// ~1.5 km cells (latitude step ≈ 1.5 km; longitude step ≈ 1.4–1.5 km at US latitudes).
const LAT_STEP = 0.0135;
const LNG_STEP = 0.015;

const snap = (value: number, step: number) => Number((Math.round(value / step) * step).toFixed(6));

/**
 * Public, approximate point for a private seller's listing: the center of a ~1.5 km grid cell.
 * Deterministic, so the same address always maps to the same cell (no averaging attack across edits).
 * Mirrored in supabase/seed.sql (pg_temp.approx).
 */
export function approximatePoint({ lat, lng }: LatLng): LatLng {
  return { lat: snap(lat, LAT_STEP), lng: snap(lng, LNG_STEP) };
}
