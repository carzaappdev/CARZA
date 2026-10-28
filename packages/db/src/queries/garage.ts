import type { TypedClient } from '../index';

export type GarageCar = {
  id: string;
  year: number;
  make: string;
  model: string;
  nickname: string | null;
  photoPath: string | null;
};

/** Someone's garage, oldest addition first (their "first" car leads). */
export async function getGarage(client: TypedClient, ownerId: string): Promise<GarageCar[]> {
  const { data, error } = await client
    .from('garage_cars')
    .select(
      'id, year, nickname, photo_path, make:vehicle_makes ( name ), model:vehicle_models ( name )',
    )
    .eq('owner_id', ownerId)
    .order('created_at');
  if (error) throw error;
  return data.map((c) => ({
    id: c.id,
    year: c.year,
    make: c.make?.name ?? '',
    model: c.model?.name ?? '',
    nickname: c.nickname,
    photoPath: c.photo_path,
  }));
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
