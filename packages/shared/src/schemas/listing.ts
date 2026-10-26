import { z } from 'zod';

/** Save or unsave a listing (the heart). */
export const setListingSavedSchema = z.object({
  // Any 8-4-4-4-12 hex id: Postgres accepts non-RFC UUIDs (the dev seed uses them).
  listingId: z.guid(),
  saved: z.boolean(),
});
export type SetListingSavedInput = z.infer<typeof setListingSavedSchema>;
