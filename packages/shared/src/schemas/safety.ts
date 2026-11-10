import { z } from 'zod';

/** What people can report in the social app. */
export const SOCIAL_REPORT_TARGETS = ['post', 'reel', 'event', 'user', 'message'] as const;
export type SocialReportTarget = (typeof SOCIAL_REPORT_TARGETS)[number];

/** Reasons offered for social content, in the order shown, with their labels. */
export const SOCIAL_REPORT_REASONS = [
  ['spam', 'Spam'],
  ['harassment', 'Harassment, threats or hate'],
  ['offensive', 'Nudity or sexual content'],
  ['intimate_image', 'Intimate image shared without consent'],
  ['child_safety', 'Child safety'],
  ['dangerous_driving', 'Street racing or dangerous driving'],
  ['copyright', 'Copyright: my work used without permission'],
  ['scam', 'Scam or fraud'],
  ['misleading', 'False or misleading'],
  ['other', 'Something else'],
] as const;

export type SocialReportReason = (typeof SOCIAL_REPORT_REASONS)[number][0];

/** Reports the law puts a clock on (intimate images: 48 hours) or that must be escalated, not just removed. */
export const URGENT_REPORT_REASONS: readonly SocialReportReason[] = [
  'child_safety',
  'intimate_image',
];

export const reportSchema = z.object({
  targetType: z.enum(SOCIAL_REPORT_TARGETS),
  targetId: z.guid(),
  reason: z.enum(SOCIAL_REPORT_REASONS.map(([value]) => value)),
  details: z.string().trim().max(2000, 'Keep it under 2,000 characters.').default(''),
});
export type ReportInput = z.infer<typeof reportSchema>;

export const setBlockedSchema = z.object({ userId: z.guid(), blocked: z.boolean() });
