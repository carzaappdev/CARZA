import { describe, expect, it } from 'vitest';
import { eventToIcs, googleCalendarUrl, type CalendarEvent } from './calendar';

const event: CalendarEvent = {
  id: 'abc',
  title: 'Cars, Coffee; & Donuts',
  description: 'Bring the car.\nAll makes welcome.',
  startsAt: '2026-11-01T14:00:00.000Z',
  endsAt: null,
  location: 'Lot 5, Austin, TX 78701',
  url: 'https://carza.app/events/abc',
};

describe('eventToIcs', () => {
  const ics = eventToIcs(event, new Date('2026-10-28T00:00:00Z'));
  it('writes UTC times and a 3-hour default length', () => {
    expect(ics).toContain('DTSTART:20261101T140000Z');
    expect(ics).toContain('DTEND:20261101T170000Z');
  });
  it('escapes text and uses CRLF line endings', () => {
    expect(ics).toContain('SUMMARY:Cars\\, Coffee\; & Donuts');
    expect(ics).toContain('Bring the car.\\nAll makes welcome.');
    expect(ics.split('\r\n').every((l) => new TextEncoder().encode(l).length <= 75)).toBe(true);
  });
});

describe('googleCalendarUrl', () => {
  it('fills the template', () => {
    const url = googleCalendarUrl({ ...event, endsAt: '2026-11-01T16:00:00.000Z' });
    expect(url).toContain(`dates=${encodeURIComponent('20261101T140000Z/20261101T160000Z')}`);
    expect(url).toContain(`text=${encodeURIComponent(event.title)}`);
  });
});
