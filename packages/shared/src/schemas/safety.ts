import { z } from 'zod';

/** What people can report in the social app. */
export const SOCIAL_REPORT_TARGETS = ['post', 'reel', 'event', 'user'] as const;
export type SocialReportTarget = (typeof SOCIAL_REPORT_TARGETS)[number];

/** Reasons offered for social content, in the order shown, with their labels. */
export const SOCIAL_REPORT_REASONS = [
  ['spam', 'Spam'],
  ['offensive', 'Harassment, hate or nudity'],
  ['scam', 'Scam or fraud'],
  ['misleading', 'False or misleading'],
  ['other', 'Something else'],
] as const;

export const reportSchema = z.object({
  targetType: z.enum(SOCIAL_REPORT_TARGETS),
  targetId: z.guid(),
  reason: z.enum(SOCIAL_REPORT_REASONS.map(([value]) => value)),
  details: z.string().trim().max(2000, 'Keep it under 2,000 characters.').default(''),
});
export type ReportInput = z.infer<typeof reportSchema>;

export const setBlockedSchema = z.object({ userId: z.guid(), blocked: z.boolean() });
