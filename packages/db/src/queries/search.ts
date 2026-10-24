import type { TypedClient } from '../index';
import type { Database } from '../database.types';

type SearchFn = Database['public']['Functions']['search_listings'];
export type SearchListingsArgs = SearchFn['Args'];

// Generated RETURNS TABLE types claim every column is non-null; these can be null in practice.
export type ListingCard = Omit<
  SearchFn['Returns'][number],
  | 'photo_path'
  | 'distance_m'
  | 'trim_level'
  | 'body_style'
  | 'drivetrain'
  | 'transmission'
  | 'fuel_type'
> & {
  photo_path: string | null;
  distance_m: number | null;
  trim_level: string | null;
  body_style: SearchFn['Returns'][number]['body_style'] | null;
  drivetrain: SearchFn['Returns'][number]['drivetrain'] | null;
  transmission: SearchFn['Returns'][number]['transmission'] | null;
  fuel_type: SearchFn['Returns'][number]['fuel_type'] | null;
};

/**
 * Radius + filter search over active listings (RLS applies). Returns one page and the total match count.
 * `total` is null when the page is empty but offset > 0 (past the end: the count is unknown, not zero).
 * The SQL caps limit at 48 and offset at 1000; validate params with Zod before calling.
 */
export async function searchListings(client: TypedClient, args: SearchListingsArgs) {
  const { data, error } = await client.rpc('search_listings', args);
  if (error) throw error;
  const rows = (data ?? []) as ListingCard[];
  const total = rows[0]?.total_count ?? ((args.p_offset ?? 0) > 0 ? null : 0);
  return { rows, total };
}
