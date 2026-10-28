import { z } from 'zod';

/** Admin decision on a report: take the content down, or close it with no action. */
export const resolveReportSchema = z.object({
  reportId: z.guid(),
  decision: z.enum(['remove', 'dismiss']),
});
