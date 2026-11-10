import { z } from 'zod';
import { emailSchema } from './auth';

/** What someone can ask the team for through the public request form. No account needed. */
export const LEGAL_REQUEST_KINDS = [
  'intimate_image',
  'copyright',
  'copyright_counter',
  'privacy',
  'other',
] as const;
export type LegalRequestKind = (typeof LEGAL_REQUEST_KINDS)[number];

export const LEGAL_REQUEST_LABELS: Record<LegalRequestKind, string> = {
  intimate_image: 'Intimate image removal',
  copyright: 'Copyright notice',
  copyright_counter: 'Copyright counter-notice',
  privacy: 'Privacy request',
  other: 'Other',
};

/** Hours Carza has to remove a reported intimate image (TAKE IT DOWN Act). */
export const INTIMATE_IMAGE_REMOVAL_HOURS = 48;

// Control characters and text-direction overrides can disguise a link or fake the layout of the
// admin's view. Line breaks and tabs are fine in the long fields.
const HIDDEN = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/;
const plain = (value: string) => !HIDDEN.test(value);
const oneLine = (value: string) => plain(value) && !/[\r\n\t]/.test(value);
const BAD_TEXT = 'Remove any unusual or hidden characters.';

export const legalRequestSchema = z.object({
  kind: z.enum(LEGAL_REQUEST_KINDS),
  name: z
    .string()
    .trim()
    .min(2, 'Enter your full name.')
    .max(120, 'Up to 120 characters.')
    .refine(oneLine, BAD_TEXT),
  email: emailSchema.refine(
    (v) => /^[a-z0-9._+-]+@[a-z0-9.-]+\.[a-z]{2,}$/.test(v),
    'Enter a valid email address.',
  ),
  urls: z
    .string()
    .trim()
    .min(5, 'Tell us where it is: paste the link, or describe the post and who posted it.')
    .max(2000, 'Up to 2,000 characters.')
    .refine(plain, BAD_TEXT),
  statement: z
    .string()
    .trim()
    .min(10, 'Add a few words about your request.')
    .max(4000, 'Up to 4,000 characters.')
    .refine(plain, BAD_TEXT),
  signature: z
    .string()
    .trim()
    .min(2, 'Type your full name to sign.')
    .max(120, 'Up to 120 characters.')
    .refine(oneLine, BAD_TEXT),
  // The statement under the form (good faith; for copyright, under penalty of perjury).
  confirmed: z.literal(true, 'Tick the box to confirm.'),
});
export type LegalRequestInput = z.input<typeof legalRequestSchema>;

export const resolveLegalRequestSchema = z.object({
  requestId: z.guid(),
  status: z.enum(['actioned', 'rejected']),
});
