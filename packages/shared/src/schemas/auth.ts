import { z } from 'zod';

// Mirrors the Supabase Auth password policy (supabase/config.toml + dashboard):
// at least 10 characters, with letters and digits.
export const passwordSchema = z
  .string()
  .min(10, 'Use at least 10 characters.')
  // bcrypt (Supabase Auth) only uses the first 72 BYTES; reject longer so no part is silently ignored.
  .refine((v) => new TextEncoder().encode(v).length <= 72, 'That password is too long.')
  .regex(/[A-Za-z]/, 'Include at least one letter.')
  .regex(/[0-9]/, 'Include at least one number.');

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email('Enter a valid email address.').max(254));

export const signInSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Enter your password.'),
});

export const signUpSchema = z.object({
  displayName: z.string().trim().min(1, 'Enter your name.').max(60, 'Use at most 60 characters.'),
  email: emailSchema,
  password: passwordSchema,
});

export const resetPasswordSchema = z.object({ email: emailSchema });

export const updatePasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((v) => v.password === v.confirmPassword, {
    message: "Passwords don't match.",
    path: ['confirmPassword'],
  });

/** OTP types accepted by /auth/confirm (links from Supabase auth emails). */
export const emailOtpTypeSchema = z.enum([
  'signup',
  'email',
  'recovery',
  'email_change',
  'invite',
  'magiclink',
]);

/** First error message per field, for showing next to inputs. */
export function fieldErrors(error: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? '_');
    out[key] ??= issue.message;
  }
  return out;
}
