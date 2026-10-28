import type { PartCategory } from '@carza/shared';
import type { TypedClient } from '../index';

export type GarageCar = {
  id: string;
  year: number;
  makeId: number;
  modelId: number;
  make: string;
  model: string;
  trimLevel: string | null;
  nickname: string | null;
  story: string | null;
  /** The cover photo (also photos[0]). */
  photoPath: string | null;
  /** Every photo, cover first. */
  photos: string[];
  modCount: number;
};

const CAR_FIELDS = `
  id, year, make_id, model_id, trim_level, nickname, story, photo_path, gallery_paths,
  make:vehicle_makes ( name ), model:vehicle_models ( name ),
  mods:garage_mods!garage_mods_car_id_owner_id_fkey ( count )
` as const;

type CarRow = {
  id: string;
  year: number;
  make_id: number;
  model_id: number;
  trim_level: string | null;
  nickname: string | null;
  story: string | null;
  photo_path: string | null;
  gallery_paths: string[];
  make: { name: string } | null;
  model: { name: string } | null;
  mods: { count: number }[];
};

function toCar(c: CarRow): GarageCar {
  return {
    id: c.id,
    year: c.year,
    makeId: c.make_id,
    modelId: c.model_id,
    make: c.make?.name ?? '',
    model: c.model?.name ?? '',
    trimLevel: c.trim_level,
    nickname: c.nickname,
    story: c.story,
    photoPath: c.photo_path,
    photos: c.photo_path ? [c.photo_path, ...c.gallery_paths] : c.gallery_paths,
    modCount: c.mods[0]?.count ?? 0,
  };
}

/** Someone's garage, oldest addition first (their "first" car leads). */
export async function getGarage(client: TypedClient, ownerId: string): Promise<GarageCar[]> {
  const { data, error } = await client
    .from('garage_cars')
    .select(CAR_FIELDS)
    .eq('owner_id', ownerId)
    .order('created_at');
  if (error) throw error;
  return data.map(toCar);
}

export type GarageMod = { id: string; category: PartCategory; name: string };

export type GarageCarDetail = GarageCar & {
  owner: { id: string; username: string; display_name: string; avatar_path: string | null };
  mods: GarageMod[];
};

/** One car with its owner and build list, or null when it's gone or hidden by a block. */
export async function getGarageCar(
  client: TypedClient,
  carId: string,
): Promise<GarageCarDetail | null> {
  const { data, error } = await client
    .from('garage_cars')
    .select(
      `${CAR_FIELDS},
      owner:profiles!garage_cars_owner_id_fkey ( id, username, display_name, avatar_path ),
      build:garage_mods!garage_mods_car_id_owner_id_fkey ( id, category, name, created_at )`,
    )
    .eq('id', carId)
    .order('created_at', { referencedTable: 'build' })
    .maybeSingle();
  if (error) throw error;
  if (!data?.owner) return null;
  return {
    ...toCar(data),
    owner: data.owner,
    mods: data.build.map((m) => ({ id: m.id, category: m.category, name: m.name })),
  };
}

export type MatchedPart = {
  id: number;
  slug: string;
  category: PartCategory;
  brand: string;
  name: string;
  blurb: string;
  /** How specific the fit is: made for this model, for the make, or for any car. */
  fit: 'model' | 'make' | 'universal';
  installed: boolean;
};

/** Parts that fit a car, best fit first (see public.parts_for_car). */
export async function getPartsForCar(client: TypedClient, carId: string): Promise<MatchedPart[]> {
  const { data, error } = await client.rpc('parts_for_car', { p_car_id: carId, p_limit: 24 });
  if (error) throw error;
  return data.map((p) => ({
    ...p,
    fit: p.fit === 'model' || p.fit === 'make' ? p.fit : 'universal',
  }));
}

export type CarOwner = {
  id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
  carId: string;
  year: number;
};

/**
 * Other people with the same model in their garage, newest additions first, one entry per person.
 * `ownerIds` holds up to 100 of them, for finding their posts and reels.
 */
export async function getSameCarOwners(
  client: TypedClient,
  modelId: number,
  excludeOwnerId: string,
  limit = 12,
): Promise<{ owners: CarOwner[]; ownerIds: string[]; total: number }> {
  const { data, error, count } = await client
    .from('garage_cars')
    .select(
      'id, year, owner:profiles!garage_cars_owner_id_fkey ( id, username, display_name, avatar_path )',
      { count: 'exact' },
    )
    .eq('model_id', modelId)
    .neq('owner_id', excludeOwnerId)
    .order('created_at', { ascending: false })
    .limit(200);
  if (error) throw error;
  const seen = new Set<string>();
  const owners: CarOwner[] = [];
  for (const row of data) {
    if (!row.owner || seen.has(row.owner.id)) continue;
    seen.add(row.owner.id);
    owners.push({ ...row.owner, carId: row.id, year: row.year });
  }
  // `count` counts cars; people with two of the same model are rare enough to ignore.
  return {
    owners: owners.slice(0, limit),
    ownerIds: owners.slice(0, 100).map((o) => o.id),
    total: Math.max(count ?? 0, owners.length),
  };
}

export type SuggestedPerson = {
  id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
  bio: string | null;
  city: string | null;
  region: string | null;
  featured: boolean;
  nearby: boolean;
  sharedMakes: number;
};

/** People to follow for the viewer (see public.suggested_follows). */
export async function getSuggestedFollows(
  client: TypedClient,
  limit = 12,
): Promise<SuggestedPerson[]> {
  const { data, error } = await client.rpc('suggested_follows', { p_limit: limit });
  if (error) throw error;
  return data.map((p) => ({
    id: p.id,
    username: p.username,
    display_name: p.display_name,
    avatar_path: p.avatar_path,
    bio: p.bio,
    city: p.city,
    region: p.region,
    featured: p.featured,
    nearby: p.nearby,
    sharedMakes: p.shared_makes,
  }));
}
