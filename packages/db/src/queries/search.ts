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

/** Radius + filter search over active listings (RLS applies). Returns one page and the total match count. */
export async function searchListings(client: TypedClient, args: SearchListingsArgs) {
  const { data, error } = await client.rpc('search_listings', args);
  if (error) throw error;
  const rows = (data ?? []) as ListingCard[];
  return { rows, total: rows[0]?.total_count ?? 0 };
}
