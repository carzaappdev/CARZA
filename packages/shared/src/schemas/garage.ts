import { z } from 'zod';
import { PART_CATEGORIES } from '../logic/garage';

export const GARAGE_MAX_CARS = 10;
export const GARAGE_MAX_PHOTOS = 8;
export const GARAGE_MAX_MODS = 50;

const userPhotoPath = z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/);

/** Optional free text: trimmed, blank becomes null. */
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .default('')
    .transform((s) => s || null);

/** A car in someone's garage. The make/model pair is checked by the database too. */
export const garageCarSchema = z.object({
  year: z.coerce
    .number()
    .int()
    .min(1900, 'Pick a year.')
    .refine((y) => y <= new Date().getFullYear() + 1, 'Pick a year.'),
  makeId: z.coerce.number().int().positive('Pick a make.'),
  modelId: z.coerce.number().int().positive('Pick a model.'),
  trimLevel: optionalText(40, 'Trims can be up to 40 characters.'),
  nickname: optionalText(40, 'Nicknames can be up to 40 characters.'),
  story: optionalText(1000, 'Keep the story under 1,000 characters.'),
  /** The first photo is the cover. */
  photoPaths: z
    .array(userPhotoPath)
    .max(GARAGE_MAX_PHOTOS, `Up to ${GARAGE_MAX_PHOTOS} photos.`)
    .refine((paths) => new Set(paths).size === paths.length, 'That photo is in there twice.')
    .default([]),
});
export type GarageCarInput = z.input<typeof garageCarSchema>;

export const garageCarIdSchema = z.object({ carId: z.guid() });

export const garageCarUpdateSchema = garageCarSchema.extend({ carId: z.guid() });

export const garageModSchema = z.object({
  carId: z.guid(),
  category: z.enum(PART_CATEGORIES, 'Pick a category.'),
  name: z.string().trim().min(1, 'Name the mod.').max(80, 'Mod names can be up to 80 characters.'),
});
export type GarageModInput = z.input<typeof garageModSchema>;

export const garageModIdSchema = z.object({ modId: z.guid() });

export const homeZipSchema = z.object({
  postalCode: z
    .string()
    .trim()
    .regex(/^[0-9]{5}$/, 'Enter a 5-digit ZIP code.'),
});

/** Years offered in pickers, newest first. */
export function garageYears(now = new Date()) {
  const latest = now.getFullYear() + 1;
  return Array.from({ length: latest - 1949 }, (_, i) => latest - i);
}
