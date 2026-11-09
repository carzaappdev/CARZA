import { z } from 'zod';

/**
 * Admin decision on a report:
 * - `dismiss`: close it with no action.
 * - `remove`: take the content down.
 * - `suspend`: suspend the account behind it (hides everything they posted).
 * - `escalate`: for child safety. Suspend the account and move the files out of public view, keeping
 *   everything as evidence. Nothing is deleted.
 */
export const REPORT_DECISIONS = ['dismiss', 'remove', 'suspend', 'escalate'] as const;
export type ReportDecision = (typeof REPORT_DECISIONS)[number];

export const resolveReportSchema = z.object({
  reportId: z.guid(),
  decision: z.enum(REPORT_DECISIONS),
});

export const setSuspendedSchema = z.object({ userId: z.guid(), suspended: z.boolean() });

/** Admin: show (or stop showing) someone first in "who to follow". */
export const setFeaturedSchema = z.object({ userId: z.guid(), featured: z.boolean() });
