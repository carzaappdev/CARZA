import type { Enums, TypedClient } from '../index';
import type { ListingCard } from './search';

// Listings have three FKs to vehicles (plain + two ownership composites), so embeds name the one to use.
const LISTING_DETAIL = `
  id, status, condition, price_cents, description, city, region, published_at, sold_at,
  vehicle:vehicles!listings_vehicle_id_fkey (
    year, make_id, model_id, trim_level, mileage, vin, body_style, drivetrain, transmission, fuel_type,
    exterior_color, interior_color,
    model:vehicle_models!vehicles_model_fk ( name, slug, make:vehicle_makes ( name, slug ) )
  ),
  photos:listing_photos ( storage_path, position, width, height ),
  dealership:dealerships!listings_seller_dealership_id_fkey ( name, slug, city, region, phone ),
  seller:profiles!listings_seller_user_id_fkey ( display_name, username, city, region )
` as const;

/** One listing with its vehicle, photos (in order) and seller. RLS decides visibility; null if hidden. */
export async function getListing(client: TypedClient, id: string) {
  const { data, error } = await client
    .from('listings')
    .select(LISTING_DETAIL)
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { ...data, photos: [...data.photos].sort((a, b) => a.position - b.position) };
}

export type ListingDetail = NonNullable<Awaited<ReturnType<typeof getListing>>>;

/** The make/model catalog (~45 makes, ~450 models), for filters and free-text matching. */
export async function getVehicleCatalog(client: TypedClient) {
  const [makes, models] = await Promise.all([
    client.from('vehicle_makes').select('id, name, slug').order('name'),
    // ~450 rows today; the explicit range keeps PostgREST's default 1000-row cap from silently cutting it.
    client.from('vehicle_models').select('id, make_id, name, slug').order('name').range(0, 4999),
  ]);
  if (makes.error) throw makes.error;
  if (models.error) throw models.error;
  return { makes: makes.data, models: models.data };
}

export type ListingInsight = {
  photoCount: number;
  /** Estimated market price from 5+ similar cars, or null when there aren't enough. */
  marketPriceCents: number | null;
  comparableCount: number;
};

/** Photo counts and market price estimates for up to 48 listings, keyed by listing id. */
export async function getListingInsights(client: TypedClient, listingIds: string[]) {
  const insights = new Map<string, ListingInsight>();
  if (listingIds.length === 0) return insights;
  const { data, error } = await client.rpc('listing_insights', { p_listing_ids: listingIds });
  if (error) throw error;
  for (const row of data ?? []) {
    insights.set(row.listing_id, {
      photoCount: row.photo_count,
      // Generated RETURNS TABLE types claim non-null; the estimate is null below 5 comparables.
      marketPriceCents: (row.market_price_cents as number | null) ?? null,
      comparableCount: row.comparable_count,
    });
  }
  return insights;
}

/** A US ZIP code's centroid and place name, or null if unknown. */
export async function getPostalCode(client: TypedClient, code: string) {
  const { data, error } = await client
    .from('postal_codes')
    .select('code, city, region, lat, lng')
    .eq('code', code)
    .maybeSingle();
  if (error) throw error;
  return data;
}

/** Which of `listingIds` the signed-in user has saved (RLS limits rows to their own). */
export async function getSavedListingIds(client: TypedClient, listingIds: string[]) {
  if (listingIds.length === 0) return new Set<string>();
  const { data, error } = await client
    .from('saved_listings')
    .select('listing_id')
    .in('listing_id', listingIds);
  if (error) throw error;
  return new Set(data.map((r) => r.listing_id));
}

/** What a listing card shows. Search rows already have this shape; other lists map to it. */
export type ListingSummary = Pick<
  ListingCard,
  | 'listing_id'
  | 'price_cents'
  | 'condition'
  | 'city'
  | 'region'
  | 'published_at'
  | 'year'
  | 'make_name'
  | 'model_name'
  | 'trim_level'
  | 'mileage'
  | 'photo_path'
  | 'seller_type'
  | 'seller_name'
  | 'distance_m'
> & { status?: Enums<'listing_status'> };

/** The signed-in user's saved cars, newest first. Listings that are no longer visible are skipped. */
export async function getSavedListings(client: TypedClient): Promise<ListingSummary[]> {
  const { data, error } = await client
    .from('saved_listings')
    .select(
      `created_at,
      listing:listings (
        id, status, condition, price_cents, city, region, published_at,
        vehicle:vehicles!listings_vehicle_id_fkey (
          year, trim_level, mileage,
          model:vehicle_models!vehicles_model_fk ( name, make:vehicle_makes ( name ) )
        ),
        photos:listing_photos ( storage_path, position ),
        dealership:dealerships!listings_seller_dealership_id_fkey ( name ),
        seller:profiles!listings_seller_user_id_fkey ( display_name )
      )`,
    )
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) throw error;
  return data.flatMap(({ listing: l }) => {
    if (!l) return [];
    const cover = [...l.photos].sort((a, b) => a.position - b.position)[0];
    return [
      {
        listing_id: l.id,
        status: l.status,
        price_cents: l.price_cents,
        condition: l.condition,
        city: l.city,
        region: l.region,
        published_at: l.published_at ?? '',
        year: l.vehicle.year,
        make_name: l.vehicle.model.make.name,
        model_name: l.vehicle.model.name,
        trim_level: l.vehicle.trim_level,
        mileage: l.vehicle.mileage,
        photo_path: cover?.storage_path ?? null,
        seller_type: l.dealership ? 'dealer' : 'private',
        seller_name: l.dealership?.name ?? l.seller?.display_name ?? '',
        distance_m: null,
      },
    ];
  });
}
