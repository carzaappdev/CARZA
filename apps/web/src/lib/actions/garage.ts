'use server';

import { revalidatePath } from 'next/cache';
import { getSuggestedFollows, type SuggestedPerson } from '@carza/db';
import {
  fail,
  garageCarIdSchema,
  garageCarSchema,
  homeZipSchema,
  ok,
  type ActionResult,
} from '@carza/shared';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export async function addGarageCar(input: unknown): Promise<ActionResult<{ id: string }>> {
  const parsed = garageCarSchema.safeParse(input);
  if (!parsed.success) {
    return fail('VALIDATION', parsed.error.issues[0]?.message ?? 'That car isn’t valid.');
  }
  const user = await getUser();
  if (!user) return fail('UNAUTHENTICATED', 'Sign in first.');

  const { year, makeId, modelId, nickname, photoPath } = parsed.data;
  if (photoPath && !photoPath.startsWith(`${user.id}/`)) {
    return fail('FORBIDDEN', 'That photo isn’t yours.');
  }
  const supabase = await createClient();
  const { data, error } = await supabase
    .from('garage_cars')
    .insert({ year, make_id: makeId, model_id: modelId, nickname, photo_path: photoPath })
    .select('id')
    .single();
  if (error) {
    if (error.code === 'CZ409') return fail('CONFLICT', 'Garages hold up to 10 cars.');
    if (error.code === 'CZ429') return fail('RATE_LIMITED', 'You’ve added a lot of cars today.');
    if (error.code === '23503') return fail('VALIDATION', 'Pick a model that matches the make.');
    console.error('addGarageCar failed', { code: error.code, userId: user.id });
    return fail('INTERNAL', 'Couldn’t add the car. Try again.');
  }
  revalidatePath('/u/[username]', 'page');
  return ok({ id: data.id });
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
    .select('photo_path');
  if (error) {
    console.error('removeGarageCar failed', { code: error.code, userId: user.id });
    return fail('INTERNAL', 'Couldn’t remove the car. Try again.');
  }
  const photo = data[0]?.photo_path;
  if (photo) await supabase.storage.from('post-photos').remove([photo]);
  revalidatePath('/u/[username]', 'page');
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
