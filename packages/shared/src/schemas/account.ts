import { z } from 'zod';

/** Deleting an account: the user types their username to confirm. */
export const deleteAccountSchema = z.object({ confirm: z.string().trim().max(60) });

/** True when the typed confirmation matches the username (case and a leading @ don't matter). */
export const deleteConfirmationMatches = (typed: string, username: string) =>
  typed.trim().replace(/^@/, '').toLowerCase() === username.toLowerCase();
