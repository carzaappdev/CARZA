import { describe, expect, it } from 'vitest';
import {
  eventDayLabel,
  groupEventsByDay,
  isoToZonedInput,
  timeZoneAbbr,
  timeZoneLabel,
  zonedInputToIso,
} from './event-time';

const chicago = 'America/Chicago';

describe('zoned inputs', () => {
  it('reads wall-clock time in the event’s timezone', () => {
    expect(zonedInputToIso('2026-11-08T19:00', chicago)).toBe('2026-11-09T01:00:00.000Z');
    expect(zonedInputToIso('2026-07-04T19:00', chicago)).toBe('2026-07-05T00:00:00.000Z');
    expect(zonedInputToIso('2026-07-04T19:00', 'America/Los_Angeles')).toBe(
      '2026-07-05T02:00:00.000Z',
    );
  });

  it('handles the days clocks change', () => {
    // Nov 1, 2026: 2 AM CDT falls back to 1 AM CST. 3 AM is after the change.
    expect(zonedInputToIso('2026-11-01T03:00', chicago)).toBe('2026-11-01T09:00:00.000Z');
    // Mar 8, 2026: 2 AM CST springs forward to 3 AM CDT. 4 AM is after the change.
    expect(zonedInputToIso('2026-03-08T04:00', chicago)).toBe('2026-03-08T09:00:00.000Z');
  });

  it('round-trips and rejects junk', () => {
    expect(isoToZonedInput('2026-11-09T01:00:00.000Z', chicago)).toBe('2026-11-08T19:00');
    expect(isoToZonedInput(null, chicago)).toBe('');
    expect(zonedInputToIso('tomorrow', chicago)).toBeNull();
  });

  it('names the zone', () => {
    expect(timeZoneAbbr(chicago, new Date('2026-07-01T00:00:00Z'))).toBe('CDT');
    expect(timeZoneAbbr('America/New_York', new Date('2026-12-01T00:00:00Z'))).toBe('EST');
  });
});

describe('day sections', () => {
  // Monday Nov 2, 2026, 10:00 AM in Chicago.
  const now = new Date('2026-11-02T16:00:00Z');
  const at = (iso: string) => eventDayLabel(iso, chicago, now);

  it('labels by the event’s local day', () => {
    expect(at('2026-11-02T15:00:00Z')).toBe('Happening now');
    expect(at('2026-11-03T04:00:00Z')).toBe('Today'); // 10 PM Monday in Chicago
    expect(at('2026-11-03T18:00:00Z')).toBe('Tomorrow');
    expect(at('2026-11-07T18:00:00Z')).toBe('Saturday');
    expect(at('2026-11-14T18:00:00Z')).toBe('Sat, Nov 14');
    expect(at('2027-01-09T18:00:00Z')).toBe('Sat, Jan 9, 2027');
  });

  it('groups consecutive events on the same day', () => {
    const e = (starts_at: string) => ({ starts_at, timezone: chicago });
    const groups = groupEventsByDay(
      [e('2026-11-03T18:00:00Z'), e('2026-11-03T20:00:00Z'), e('2026-11-07T18:00:00Z')],
      now,
    );
    expect(groups.map((g) => [g.label, g.events.length])).toEqual([
      ['Tomorrow', 2],
      ['Saturday', 1],
    ]);
  });
});

describe('timeZoneLabel', () => {
  it('names the city for regional zones', () => {
    expect(timeZoneLabel('America/New_York', new Date('2026-01-15T12:00:00Z'))).toBe(
      'EST (America/New York)',
    );
  });
  it('does not repeat itself for UTC', () => {
    expect(timeZoneLabel('UTC')).toBe('UTC');
    expect(timeZoneLabel('Etc/UTC')).not.toContain('Etc/UTC');
  });
});
