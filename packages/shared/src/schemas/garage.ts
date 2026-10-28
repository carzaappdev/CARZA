import { z } from 'zod';

export const GARAGE_MAX_CARS = 10;

/** A car in someone's garage. The make/model pair is checked by the database too. */
export const garageCarSchema = z.object({
  year: z.coerce
    .number()
    .int()
    .min(1900, 'Pick a year.')
    .refine((y) => y <= new Date().getFullYear() + 1, 'Pick a year.'),
  makeId: z.coerce.number().int().positive('Pick a make.'),
  modelId: z.coerce.number().int().positive('Pick a model.'),
  nickname: z
    .string()
    .trim()
    .max(40, 'Nicknames can be up to 40 characters.')
    .transform((s) => s || null),
  photoPath: z
    .string()
    .regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/)
    .nullable(),
});
export type GarageCarInput = z.input<typeof garageCarSchema>;

export const garageCarIdSchema = z.object({ carId: z.guid() });

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
