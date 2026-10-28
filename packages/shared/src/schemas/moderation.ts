import { z } from 'zod';

/** Admin decision on a report: take the content down, or close it with no action. */
export const resolveReportSchema = z.object({
  reportId: z.guid(),
  decision: z.enum(['remove', 'dismiss']),
});

/** Admin: show (or stop showing) someone first in "who to follow". */
export const setFeaturedSchema = z.object({ userId: z.guid(), featured: z.boolean() });
