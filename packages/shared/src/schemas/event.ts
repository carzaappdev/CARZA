import { z } from 'zod';
import { ZIP_CODE } from './search';

const imagePath = z.string().regex(/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.(jpg|png|webp)$/);
const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, message)
    .transform((v) => (v === '' ? null : v))
    .nullable();

/** Host or edit an event. Times are instants (ISO with offset); `timezone` is where the event happens. */
const eventFields = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Give it a name (3+ characters).')
      .max(100, 'Up to 100 characters.'),
    description: z.string().trim().max(2000, 'Up to 2,000 characters.'),
    startsAt: z.iso.datetime({ offset: true, message: 'Pick a start date and time.' }),
    endsAt: z.iso.datetime({ offset: true }).nullable(),
    timezone: z.string().min(1).max(64),
    venueName: z
      .string()
      .trim()
      .min(1, 'Where is it? Add a place name.')
      .max(100, 'Up to 100 characters.'),
    address: optionalText(200, 'Up to 200 characters.'),
    postalCode: z.string().trim().regex(ZIP_CODE, 'Enter a 5-digit ZIP code.'),
    capacity: z.int().min(1, 'At least 1.').max(10000, 'Up to 10,000.').nullable(),
    coverPath: imagePath.nullable(),
    /** 18+ only: hidden from teens. */
    adultsOnly: z.boolean().default(false),
  })
  .refine((e) => !e.endsAt || new Date(e.endsAt) > new Date(e.startsAt), {
    message: 'The end must be after the start.',
    path: ['endsAt'],
  })
  .refine(
    (e) =>
      !e.endsAt || new Date(e.endsAt).getTime() - new Date(e.startsAt).getTime() <= 7 * 86_400_000,
    { message: 'Events can run up to 7 days.', path: ['endsAt'] },
  );

/** A new event must start in the future. */
export const eventFormSchema = eventFields.refine(
  (e) => new Date(e.startsAt).getTime() > Date.now(),
  { message: 'The start time has already passed.', path: ['startsAt'] },
);
export type EventFormInput = z.input<typeof eventFormSchema>;

export const eventIdSchema = z.object({ eventId: z.guid() });
export const setRsvpSchema = z.object({ eventId: z.guid(), going: z.boolean() });
/** Cars from your garage you're bringing to an event you're going to. */
export const EVENT_MAX_CARS = 3;
export const setRsvpCarsSchema = z.object({
  eventId: z.guid(),
  carIds: z.array(z.guid()).max(EVENT_MAX_CARS),
});
/** Edits may keep a start time that has passed (the meet is under way); the database refuses moving one into the past. */
export const updateEventSchema = z.object({ eventId: z.guid(), event: eventFields });
