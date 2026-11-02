/**
 * Event times are typed as wall-clock time where the event happens ("7:00 PM in Chicago"), whatever the
 * device's own timezone, and lists are grouped by that local day.
 */

const partsFormat = (timeZone: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });

/** Wall-clock fields of an instant in `timeZone`. */
function wallClock(ms: number, timeZone: string) {
  const p = Object.fromEntries(
    partsFormat(timeZone)
      .formatToParts(new Date(ms))
      .map((x) => [x.type, x.value]),
  );
  return {
    year: Number(p.year),
    month: Number(p.month),
    day: Number(p.day),
    hour: Number(p.hour),
    minute: Number(p.minute),
  };
}

/** How far `timeZone` is ahead of UTC at instant `ms`, in ms. */
function offsetMs(ms: number, timeZone: string) {
  const w = wallClock(ms, timeZone);
  const asUtc = Date.UTC(w.year, w.month - 1, w.day, w.hour, w.minute);
  return asUtc - Math.floor(ms / 60_000) * 60_000;
}

/** "2026-11-08T19:00" in America/Chicago → "2026-11-09T01:00:00.000Z". Null for anything malformed. */
export function zonedInputToIso(local: string, timeZone: string): string | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(local);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number) as [number, number, number, number, number, number];
  const guess = Date.UTC(y, mo - 1, d, h, mi);
  if (Number.isNaN(guess)) return null;
  // Two passes settle DST edges: the offset at the first answer is the one that applies.
  let ms = guess - offsetMs(guess, timeZone);
  ms = guess - offsetMs(ms, timeZone);
  return new Date(ms).toISOString();
}

/** ISO instant → "YYYY-MM-DDTHH:mm" in `timeZone`, for a datetime-local input. */
export function isoToZonedInput(iso: string | null, timeZone: string) {
  if (!iso) return '';
  const w = wallClock(new Date(iso).getTime(), timeZone);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${w.year}-${pad(w.month)}-${pad(w.day)}T${pad(w.hour)}:${pad(w.minute)}`;
}

/** "CST", "PDT", or "GMT-5" where there's no common abbreviation. */
export function timeZoneAbbr(timeZone: string, at = new Date()) {
  return (
    new Intl.DateTimeFormat('en-US', { timeZone, timeZoneName: 'short' })
      .formatToParts(at)
      .find((p) => p.type === 'timeZoneName')?.value ?? timeZone
  );
}

/** Days since the epoch for the calendar date of `ms` in `timeZone`. */
function dayNumber(ms: number, timeZone: string) {
  const w = wallClock(ms, timeZone);
  return Date.UTC(w.year, w.month - 1, w.day) / 86_400_000;
}

/** Section heading for an event in a list: "Happening now", "Today", "Tomorrow", "Saturday", "Sat, Nov 21". */
export function eventDayLabel(startsAt: string, timeZone: string, now = new Date()) {
  const start = new Date(startsAt);
  if (start <= now) return 'Happening now';
  const days = dayNumber(start.getTime(), timeZone) - dayNumber(now.getTime(), timeZone);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 7) return start.toLocaleDateString('en-US', { weekday: 'long', timeZone });
  return start.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    timeZone,
    ...(start.getUTCFullYear() === now.getUTCFullYear() ? {} : { year: 'numeric' }),
  });
}

/** Splits a soonest-first list into consecutive day sections. */
export function groupEventsByDay<T extends { starts_at: string; timezone: string }>(
  events: T[],
  now = new Date(),
) {
  const groups: { label: string; events: T[] }[] = [];
  for (const event of events) {
    const label = eventDayLabel(event.starts_at, event.timezone, now);
    const last = groups.at(-1);
    if (last?.label === label) last.events.push(event);
    else groups.push({ label, events: [event] });
  }
  return groups;
}
