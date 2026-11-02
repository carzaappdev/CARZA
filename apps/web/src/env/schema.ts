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
  // Web push (VAPID) public key. Optional: without it the app simply doesn't offer push alerts.
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: z
    .string()
    .regex(/^[A-Za-z0-9_-]{87}$/)
    .optional(),
});

export const serverSchema = z.object({
  // Optional until a feature truly needs to bypass RLS. Never exposed to the browser.
  SUPABASE_SECRET_KEY: z.string().min(20).optional(),
  // Optional until the app sends its own email (auth emails come from Supabase). Make these required
  // for production in the same change that adds the first sender.
  RESEND_API_KEY: z.string().startsWith('re_').optional(),
  EMAIL_FROM: z.string().min(3).optional(),
  // Web push: the VAPID private key that signs pushes, and the secret the database sends to the
  // dispatch route (also stored in Supabase Vault as 'push_dispatch_secret'). Optional: no push without them.
  VAPID_PRIVATE_KEY: z
    .string()
    .regex(/^[A-Za-z0-9_-]{43}$/)
    .optional(),
  PUSH_DISPATCH_SECRET: z.string().min(32).optional(),
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
