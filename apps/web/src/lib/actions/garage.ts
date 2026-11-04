'use server';

import { revalidatePath } from 'next/cache';
import { getSuggestedFollows, type SuggestedPerson } from '@carza/db';
import {
  fail,
  garageCarIdSchema,
  garageCarSchema,
  garageCarUpdateSchema,
  garageModIdSchema,
  garageModSchema,
  homeZipSchema,
  ok,
  type ActionResult,
  type PartCategory,
} from '@carza/shared';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

type CarInput = ReturnType<typeof garageCarSchema.parse>;

/** Column values for a car. The first photo is the cover; the rest are the gallery. */
function carColumns({ year, makeId, modelId, trimLevel, nickname, story, photoPaths }: CarInput) {
  return {
    year,
    make_id: makeId,
    model_id: modelId,
    trim_level: trimLevel,
    nickname,
    story,
    photo_path: photoPaths[0] ?? null,
    gallery_paths: photoPaths.slice(1),
  };
}

function carError(action: string, error: { code: string }, userId: string) {
  if (error.code === 'CZ409') return fail('CONFLICT', 'Garages hold up to 10 cars.');
  if (error.code === 'CZ429') return fail('RATE_LIMITED', 'You’ve added a lot of cars today.');
  if (error.code === '23503') return fail('VALIDATION', 'Pick a model that matches the make.');
  console.error(`${action} failed`, { code: error.code, userId });
  return fail('INTERNAL', 'Couldn’t save the car. Try again.');
}

function revalidateGarage(carId?: string) {
  revalidatePath('/u/[username]', 'page');
  revalidatePath('/account/garage');
  if (carId) revalidatePath(`/garage/${carId}`);
}

export async function addGarageCar(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = garageCarSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION', parsed.error.issues[0]?.message ?? 'That car isn’t valid.');
  }
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in first.');
  if (parsed.data.photoPaths.some((p) => !p.startsWith(`${user.id}/`))) {
    return fail('FORBIDDEN', 'That photo isn’t yours.');
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('garage_cars')
    .insert(carColumns(parsed.data))
    .select('id')
    .single();
  if (error) return carError('addGarageCar', error, user.id);
  revalidateGarage();
  return ok({ id: data.id });
}

export async function updateGarageCar(input: unknown): Promise<ActionResult<null>> {
  const parsed = garageCarUpdateSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION', parsed.error.issues[0]?.message ?? 'That car isn’t valid.');
  }
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in first.');
  if (parsed.data.photoPaths.some((p) => !p.startsWith(`${user.id}/`))) {
    return fail('FORBIDDEN', 'That photo isn’t yours.');
  }

  const supabase = await createClient();
  const { data: before } = await supabase
    .from('garage_cars')
    .select('photo_path, gallery_paths')
    .eq('id', parsed.data.carId)
    .eq('owner_id', user.id)
    .maybeSingle();
  if (!before) return fail('NOT_FOUND', 'That car isn’t in your garage.');

  const { error } = await supabase
    .from('garage_cars')
    .update(carColumns(parsed.data))
    .eq('id', parsed.data.carId)
    .eq('owner_id', user.id);
  if (error) return carError('updateGarageCar', error, user.id);

  // Delete the photos that were taken out.
  const kept = new Set(parsed.data.photoPaths);
  const dropped = [before.photo_path, ...before.gallery_paths].filter(
    (p): p is string => !!p && !kept.has(p),
  );
  if (dropped.length) await supabase.storage.from('post-photos').remove(dropped);
  revalidateGarage(parsed.data.carId);
  return ok(null);
}

export async function removeGarageCar(input: unknown): Promise<ActionResult<null>> {
  const parsed = garageCarIdSchema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION', 'That request wasn’t valid.');
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in first.');

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('garage_cars')
    .delete()
    .eq('id', parsed.data.carId)
    .eq('owner_id', user.id)
    .select('photo_path, gallery_paths');
  if (error) {
    console.error('removeGarageCar failed', { code: error.code, userId: user.id });
    return fail('INTERNAL', 'Couldn’t remove the car. Try again.');
  }
  const photos = data
    .flatMap((c) => [c.photo_path, ...c.gallery_paths])
    .filter((p): p is string => !!p);
  if (photos.length) await supabase.storage.from('post-photos').remove(photos);
  revalidateGarage(parsed.data.carId);
  return ok(null);
}

export async function addGarageMod(
  input: unknown,
): Promise<ActionResult<{ id: string; category: PartCategory; name: string }>> {
  const parsed = garageModSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION', parsed.error.issues[0]?.message ?? 'That mod isn’t valid.');
  }
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in first.');

  const { carId, category, name } = parsed.data;
  // RLS sets the owner to the signed-in user; the composite key rejects someone else's car.
  const { data, error } = await (
    await createClient()
  )
    .from('garage_mods')
    .insert({ car_id: carId, category, name })
    .select('id, category, name')
    .single();
  if (error) {
    if (error.code === 'CZ409') return fail('CONFLICT', 'A car holds up to 50 mods.');
    if (error.code === 'CZ429') return fail('RATE_LIMITED', 'You’ve added a lot of mods today.');
    if (error.code === '23503') return fail('FORBIDDEN', 'That car isn’t in your garage.');
    console.error('addGarageMod failed', { code: error.code, userId: user.id });
    return fail('INTERNAL', 'Couldn’t add the mod. Try again.');
  }
  revalidateGarage(carId);
  return ok(data);
}

export async function removeGarageMod(input: unknown): Promise<ActionResult<null>> {
  const parsed = garageModIdSchema.safeParse(input);
  if (!parsed.success) return fail('VALIDATION', 'That request wasn’t valid.');
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in first.');

  const { data, error } = await (
    await createClient()
  )
    .from('garage_mods')
    .delete()
    .eq('id', parsed.data.modId)
    .eq('owner_id', user.id)
    .select('car_id');
  if (error) {
    console.error('removeGarageMod failed', { code: error.code, userId: user.id });
    return fail('INTERNAL', 'Couldn’t remove the mod. Try again.');
  }
  revalidateGarage(data[0]?.car_id);
  return ok(null);
}

/** Sets the viewer's home ZIP. The database places them and shows their city on their profile. */
export async function setHomeZip(input: unknown): Promise<ActionResult<{ city: string | null }>> {
  const parsed = homeZipSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION', parsed.error.issues[0]?.message ?? 'Enter a 5-digit ZIP code.');
  }
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in first.');

  const supabase = await createClient();
  const { error } = await supabase
    .from('profile_private')
    .update({ postal_code: parsed.data.postalCode })
    .eq('user_id', user.id);
  if (error) {
    if (error.code === '22023') return fail('VALIDATION', 'We don’t know that ZIP code.');
    console.error('setHomeZip failed', { code: error.code, userId: user.id });
    return fail('INTERNAL', 'Couldn’t save your ZIP. Try again.');
  }
  const { data } = await supabase
    .from('profiles')
    .select('city, region')
    .eq('id', user.id)
    .single();
  return ok({ city: data?.city ? `${data.city}, ${data.region}` : null });
}

export async function completeOnboarding(): Promise<ActionResult<null>> {
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in first.');
  const { error } = await (await createClient()).rpc('complete_onboarding');
  if (error) {
    console.error('completeOnboarding failed', { code: error.code, userId: user.id });
    return fail('INTERNAL', 'Couldn’t save. Try again.');
  }
  return ok(null);
}

/** People to follow, for the last onboarding step (depends on the ZIP and cars just entered). */
export async function loadSuggestedFollows(): Promise<ActionResult<SuggestedPerson[]>> {
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in first.');
  try {
    return ok(await getSuggestedFollows(await createClient(), 12));
  } catch {
    return fail('INTERNAL', 'Couldn’t load suggestions.');
  }
}
