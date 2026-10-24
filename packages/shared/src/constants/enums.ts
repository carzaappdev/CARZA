// Mirrors the Postgres enums (supabase/migrations). Order matters where noted.
// packages/db/src/enums.test.ts fails CI if these drift from the database.

export const APP_ROLES = ['user', 'admin'] as const;
/** Lowest → highest privilege. */
export const DEALER_ROLES = ['staff', 'admin', 'owner'] as const;
export const VERIFICATION_STATUSES = ['pending', 'verified', 'rejected', 'suspended'] as const;
export const LISTING_STATUSES = ['draft', 'active', 'pending', 'sold', 'removed'] as const;
export const LISTING_CONDITIONS = ['new', 'used', 'certified'] as const;
export const BODY_STYLES = [
  'sedan',
  'coupe',
  'hatchback',
  'wagon',
  'convertible',
  'suv',
  'crossover',
  'pickup',
  'minivan',
  'van',
  'other',
] as const;
export const DRIVETRAINS = ['fwd', 'rwd', 'awd', '4wd'] as const;
export const TRANSMISSIONS = ['automatic', 'manual', 'cvt', 'dct'] as const;
export const FUEL_TYPES = [
  'gasoline',
  'diesel',
  'hybrid',
  'plug_in_hybrid',
  'electric',
  'flex',
  'other',
] as const;
export const TEST_DRIVE_STATUSES = [
  'requested',
  'confirmed',
  'declined',
  'cancelled',
  'completed',
] as const;
export const NOTIFICATION_TYPES = [
  'new_message',
  'test_drive_requested',
  'test_drive_confirmed',
  'test_drive_declined',
  'test_drive_cancelled',
  'dealership_verified',
  'dealership_rejected',
  'dealership_invite',
] as const;
export const REPORT_TARGETS = ['listing', 'user', 'message', 'dealership'] as const;
export const REPORT_REASONS = [
  'scam',
  'spam',
  'offensive',
  'misleading',
  'stolen',
  'other',
] as const;
export const REPORT_STATUSES = ['open', 'reviewing', 'resolved', 'dismissed'] as const;

export type AppRole = (typeof APP_ROLES)[number];
export type DealerRole = (typeof DEALER_ROLES)[number];
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];
export type ListingStatus = (typeof LISTING_STATUSES)[number];
export type ListingCondition = (typeof LISTING_CONDITIONS)[number];
export type BodyStyle = (typeof BODY_STYLES)[number];
export type Drivetrain = (typeof DRIVETRAINS)[number];
export type Transmission = (typeof TRANSMISSIONS)[number];
export type FuelType = (typeof FUEL_TYPES)[number];
export type TestDriveStatus = (typeof TEST_DRIVE_STATUSES)[number];
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];
export type ReportTarget = (typeof REPORT_TARGETS)[number];
export type ReportReason = (typeof REPORT_REASONS)[number];
export type ReportStatus = (typeof REPORT_STATUSES)[number];
