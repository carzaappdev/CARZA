import { z } from 'zod';
import {
  BODY_STYLES,
  DRIVETRAINS,
  FUEL_TYPES,
  LISTING_CONDITIONS,
  TRANSMISSIONS,
  type BodyStyle,
  type Drivetrain,
  type FuelType,
  type ListingCondition,
  type Transmission,
} from '../constants/enums';
import { LIMITS } from '../constants/limits';
import type { LatLng } from '../logic/geo';

// Search filters live in the URL (shareable, server-rendered). The same schema will parse the mobile app's
// params. Parsing is forgiving: a bad or tampered value is dropped, never an error page.

export const SEARCH_SORTS = [
  'newest',
  'price_asc',
  'price_desc',
  'mileage_asc',
  'year_desc',
  'distance',
] as const;
export type SearchSort = (typeof SEARCH_SORTS)[number];

export const SELLER_TYPES = ['private', 'dealer'] as const;
export type SellerType = (typeof SELLER_TYPES)[number];

/** A five-digit US ZIP code. */
export const ZIP_CODE = /^\d{5}$/;

export const SEARCH_RADIUS_MILES = [10, 25, 50, 100, 250, 500] as const;
export const DEFAULT_SEARCH_RADIUS_MILES = 50;
export const SEARCH_PAGE_SIZE = 24;
/** The database caps the offset at 1000, so this is the last page that can be fetched. */
export const SEARCH_MAX_PAGE = Math.floor(1000 / SEARCH_PAGE_SIZE) + 1;

/** URL params arrive as string | string[] | undefined. Take the first value; treat blanks as missing. */
const first = (v: unknown) => {
  const value = Array.isArray(v) ? v[0] : v;
  return typeof value === 'string' && value.trim() === '' ? undefined : value;
};

const int = (min: number, max: number) =>
  z.preprocess(first, z.coerce.number().int().min(min).max(max).optional()).catch(undefined);

const num = (min: number, max: number) =>
  z.preprocess(first, z.coerce.number().min(min).max(max).optional()).catch(undefined);

const oneOf = <T extends string>(values: readonly [T, ...T[]]) =>
  z.preprocess(first, z.enum(values).optional()).catch(undefined);

const slug = z
  .preprocess(
    first,
    z
      .string()
      .regex(/^[a-z0-9-]{1,60}$/)
      .optional(),
  )
  .catch(undefined);

/** Repeated keys (`?body=suv&body=sedan`) or a comma list. Unknown values are dropped. */
const listOf = <T extends string>(values: readonly T[]) =>
  z
    .unknown()
    .transform((v) => {
      const raw = (Array.isArray(v) ? v : [v]).flatMap((x) =>
        typeof x === 'string' ? x.split(',') : [],
      );
      const picked = [
        ...new Set(raw.filter((x): x is T => (values as readonly string[]).includes(x))),
      ];
      return picked.length ? picked : undefined;
    })
    .catch(undefined);

export const searchFiltersSchema = z.object({
  /** Free text from the header search box. The page resolves it to a make/model. */
  q: z.preprocess(first, z.string().trim().max(100).optional()).catch(undefined),
  make: slug,
  model: slug,
  yearMin: int(1900, 2100),
  yearMax: int(1900, 2100),
  /** Whole dollars in the URL; cents in the database. */
  priceMin: int(0, 10_000_000),
  priceMax: int(0, 10_000_000),
  mileageMax: int(0, 2_000_000),
  body: listOf<BodyStyle>(BODY_STYLES),
  fuel: listOf<FuelType>(FUEL_TYPES),
  drive: listOf<Drivetrain>(DRIVETRAINS),
  trans: listOf<Transmission>(TRANSMISSIONS),
  condition: oneOf<ListingCondition>(LISTING_CONDITIONS),
  seller: oneOf<SellerType>(SELLER_TYPES),
  /** A US ZIP code to search around. The page looks up its coordinates. */
  zip: z.preprocess(first, z.string().trim().regex(ZIP_CODE).optional()).catch(undefined),
  /** Coordinates from "Use my location" (rounded by the browser). */
  lat: num(-90, 90),
  lng: num(-180, 180),
  radius: int(1, LIMITS.searchRadiusMilesMax),
  sort: oneOf<SearchSort>(SEARCH_SORTS),
  page: int(1, SEARCH_MAX_PAGE),
});

export type SearchFilters = z.infer<typeof searchFiltersSchema>;

export function parseSearchFilters(params: Record<string, unknown>): SearchFilters {
  return searchFiltersSchema.parse(params);
}

const hasCoords = (f: SearchFilters) => f.lat !== undefined && f.lng !== undefined;

/** Whether the search is centered somewhere (a ZIP code or the device's location). */
export const hasLocation = (f: SearchFilters) => f.zip !== undefined || hasCoords(f);

/**
 * Filters → `search_listings` RPC args. Make/model arrive as slugs and the location may be a ZIP code, so
 * the caller passes the ids and the origin it resolved. Shape matches the generated RPC types in @carza/db.
 */
export function toSearchArgs(
  f: SearchFilters,
  resolved: { makeId?: number; modelId?: number; origin?: LatLng } = {},
) {
  const origin =
    resolved.origin ??
    (f.lat !== undefined && f.lng !== undefined ? { lat: f.lat, lng: f.lng } : undefined);
  const page = f.page ?? 1;
  const sort = f.sort === 'distance' && !origin ? 'newest' : (f.sort ?? 'newest');
  return {
    p_lat: origin?.lat,
    p_lng: origin?.lng,
    p_radius_miles: f.radius ?? DEFAULT_SEARCH_RADIUS_MILES,
    p_make_id: resolved.makeId,
    p_model_id: resolved.modelId,
    p_year_min: f.yearMin,
    p_year_max: f.yearMax,
    p_price_min_cents: f.priceMin === undefined ? undefined : f.priceMin * 100,
    p_price_max_cents: f.priceMax === undefined ? undefined : f.priceMax * 100,
    p_mileage_max: f.mileageMax,
    p_body_styles: f.body,
    p_drivetrains: f.drive,
    p_fuel_types: f.fuel,
    p_transmissions: f.trans,
    p_condition: f.condition,
    p_seller_type: f.seller,
    p_sort: sort,
    p_limit: SEARCH_PAGE_SIZE,
    p_offset: (page - 1) * SEARCH_PAGE_SIZE,
  };
}

/**
 * Filters → a canonical query string (fixed key order, defaults dropped), for links like pagination and
 * "remove this filter". `patch` overrides keys; set a key to undefined to remove it.
 */
export function toSearchQuery(f: SearchFilters, patch: Partial<SearchFilters> = {}): string {
  const merged: SearchFilters = { ...f, ...patch };
  const parts: string[] = [];
  for (const key of Object.keys(searchFiltersSchema.shape) as (keyof SearchFilters)[]) {
    const value = merged[key];
    if (value === undefined) continue;
    if (key === 'page' && value === 1) continue;
    if (key === 'sort' && value === 'newest') continue;
    for (const v of Array.isArray(value) ? value : [value]) {
      parts.push(`${key}=${encodeURIComponent(String(v))}`);
    }
  }
  return parts.join('&');
}

/** `/search` link for these filters (see toSearchQuery). */
export function searchHref(f: SearchFilters, patch: Partial<SearchFilters> = {}) {
  const query = toSearchQuery(f, patch);
  return query ? `/search?${query}` : '/search';
}
