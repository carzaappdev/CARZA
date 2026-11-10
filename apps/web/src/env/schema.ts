import { z } from 'zod';

/**
 * Single source of truth for environment variables.
 * - `clientSchema`: NEXT_PUBLIC_* only. Inlined into the browser bundle. Never put secrets here.
 * - `serverSchema`: server-only secrets. Read through `@/env/server` (guarded by `server-only`).
 * `next.config.ts` calls `validateEnv` so a missing/invalid variable fails `next dev` and `next build`.
 */
export const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(20),
  NEXT_PUBLIC_SITE_URL: z.url(),
  // Shown on the legal pages. Optional so the app still builds without them, but set all three before
  // launch: the address people write to, the company's legal name, and its postal address (the
  // copyright agent's details must match what's registered with the US Copyright Office).
  NEXT_PUBLIC_CONTACT_EMAIL: z.email().optional(),
  NEXT_PUBLIC_LEGAL_NAME: z.string().min(2).max(120).optional(),
  NEXT_PUBLIC_LEGAL_ADDRESS: z.string().min(5).max(300).optional(),
});

export const serverSchema = z.object({
  // Optional until a feature truly needs to bypass RLS. Never exposed to the browser.
  SUPABASE_SECRET_KEY: z.string().min(20).optional(),
  // Optional until the app sends its own email (auth emails come from Supabase). Make these required
  // for production in the same change that adds the first sender.
  RESEND_API_KEY: z.string().startsWith('re_').optional(),
  EMAIL_FROM: z.string().min(3).optional(),
});

/** Validates everything at once and throws a readable error listing every problem. */
export function validateEnv(source: Record<string, string | undefined>) {
  const schema = clientSchema.extend(serverSchema.shape);
  // Treat empty strings (e.g. `KEY=` copied from .env.example) as missing.
  const cleaned = Object.fromEntries(
    Object.entries(source).map(([k, v]) => [k, v === '' ? undefined : v]),
  );
  const result = schema.safeParse(cleaned);
  if (!result.success) {
    const lines = result.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Invalid environment variables (see .env.example):\n${lines.join('\n')}`);
  }
  return result.data;
}
