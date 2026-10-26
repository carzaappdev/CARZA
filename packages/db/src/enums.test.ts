import { describe, expect, it } from 'vitest';
import * as shared from '@carza/shared';
import { Constants } from './database.types';

// Fails when a migration changes an enum but @carza/shared/constants wasn't updated (or vice versa).
describe('shared enum constants match the database', () => {
  const db = Constants.public.Enums;
  const pairs = [
    ['app_role', shared.APP_ROLES],
    ['dealer_role', shared.DEALER_ROLES],
    ['verification_status', shared.VERIFICATION_STATUSES],
    ['listing_status', shared.LISTING_STATUSES],
    ['listing_condition', shared.LISTING_CONDITIONS],
    ['body_style', shared.BODY_STYLES],
    ['drivetrain', shared.DRIVETRAINS],
    ['transmission', shared.TRANSMISSIONS],
    ['fuel_type', shared.FUEL_TYPES],
    ['test_drive_status', shared.TEST_DRIVE_STATUSES],
    ['notification_type', shared.NOTIFICATION_TYPES],
    ['report_target', shared.REPORT_TARGETS],
    ['report_reason', shared.REPORT_REASONS],
    ['report_status', shared.REPORT_STATUSES],
  ] as const;

  it.each(pairs)('%s', (name, values) => {
    expect([...values]).toEqual([...db[name]]);
  });

  it('covers every database enum', () => {
    expect(pairs.map(([name]) => name).sort()).toEqual(Object.keys(db).sort());
  });
});
