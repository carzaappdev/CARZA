import { describe, expect, it } from 'vitest';
import { eventFormSchema, updateEventSchema } from './event';

const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();
const event = (startsAt: string) => ({
  title: 'Cars & Coffee',
  description: '',
  startsAt,
  endsAt: null,
  timezone: 'America/Chicago',
  venueName: 'Lot',
  address: '',
  postalCode: '78701',
  capacity: null,
  coverPath: null,
});
const eventId = '6f1c0b1e-8a6f-4f7a-9a51-1d6c0f2a7b10';

describe('event schemas', () => {
  it('new events start in the future', () => {
    expect(eventFormSchema.safeParse(event(inHours(2))).success).toBe(true);
    expect(eventFormSchema.safeParse(event(inHours(-1))).success).toBe(false);
  });

  it('a meet that’s under way can still be edited', () => {
    expect(updateEventSchema.safeParse({ eventId, event: event(inHours(-1)) }).success).toBe(true);
  });

  it('ends after it starts, within a week', () => {
    const start = inHours(2);
    expect(eventFormSchema.safeParse({ ...event(start), endsAt: inHours(1) }).success).toBe(false);
    expect(eventFormSchema.safeParse({ ...event(start), endsAt: inHours(24 * 8) }).success).toBe(
      false,
    );
  });
});
