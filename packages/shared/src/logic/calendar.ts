/** Calendar exports for an event: an .ics file (Apple/Outlook) and a Google Calendar link. */

export type CalendarEvent = {
  id: string;
  title: string;
  description: string;
  startsAt: string;
  /** Events without an end time are shown as 3 hours long. */
  endsAt: string | null;
  location: string;
  url: string;
};

const DEFAULT_LENGTH_MS = 3 * 3_600_000;

/** 2026-11-01T14:00:00.000Z → 20261101T140000Z */
const utcStamp = (iso: string) =>
  new Date(iso)
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

const endOf = (e: CalendarEvent) =>
  e.endsAt ?? new Date(new Date(e.startsAt).getTime() + DEFAULT_LENGTH_MS).toISOString();

/** RFC 5545 text escaping. */
const escapeText = (s: string) =>
  s.replace(/\\/g, '\\\\').replace(/;/g, '\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Lines longer than 75 octets are folded with CRLF + space (RFC 5545 §3.1). */
function fold(line: string) {
  const bytes = new TextEncoder().encode(line);
  if (bytes.length <= 75) return line;
  const out: string[] = [];
  let current = '';
  let size = 0;
  for (const ch of line) {
    const n = new TextEncoder().encode(ch).length;
    if (size + n > (out.length ? 74 : 75)) {
      out.push(current);
      current = '';
      size = 0;
    }
    current += ch;
    size += n;
  }
  out.push(current);
  return out.join('\r\n ');
}

export function eventToIcs(e: CalendarEvent, now = new Date()) {
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Carza//Events//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${e.id}@carza`,
    `DTSTAMP:${utcStamp(now.toISOString())}`,
    `DTSTART:${utcStamp(e.startsAt)}`,
    `DTEND:${utcStamp(endOf(e))}`,
    `SUMMARY:${escapeText(e.title)}`,
    `DESCRIPTION:${escapeText([e.description, e.url].filter(Boolean).join('\n\n'))}`,
    `LOCATION:${escapeText(e.location)}`,
    `URL:${e.url}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.map(fold).join('\r\n') + '\r\n';
}

export function googleCalendarUrl(e: CalendarEvent) {
  const params: [string, string][] = [
    ['action', 'TEMPLATE'],
    ['text', e.title],
    ['dates', `${utcStamp(e.startsAt)}/${utcStamp(endOf(e))}`],
    ['details', [e.description, e.url].filter(Boolean).join('\n\n')],
    ['location', e.location],
  ];
  const query = params.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&');
  return `https://calendar.google.com/calendar/render?${query}`;
}
