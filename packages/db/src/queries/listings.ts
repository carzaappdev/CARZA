import type { TypedClient } from '../index';

// Listings have three FKs to vehicles (plain + two ownership composites), so embeds name the one to use.
const LISTING_DETAIL = `
  id, status, condition, price_cents, description, city, region, published_at, sold_at,
  vehicle:vehicles!listings_vehicle_id_fkey (
    year, trim_level, mileage, vin, body_style, drivetrain, transmission, fuel_type,
    exterior_color, interior_color,
    model:vehicle_models!vehicles_model_fk ( name, make:vehicle_makes ( name ) )
  ),
  photos:listing_photos ( storage_path, position, width, height ),
  dealership:dealerships!listings_seller_dealership_id_fkey ( name, slug, city, region, phone, website ),
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
