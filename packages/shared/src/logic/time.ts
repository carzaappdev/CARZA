/** Threads-style relative time: "now", "5m", "3h", "2d", then a short date ("Mar 4", "Mar 4, 2025"). */
export function formatRelativeTime(iso: string, now: Date = new Date()) {
  const then = new Date(iso);
  const seconds = Math.max(0, Math.floor((now.getTime() - then.getTime()) / 1000));
  if (seconds < 60) return 'now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d`;
  return then.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(then.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
}

const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

/** 950 → "950", 1200 → "1.2K". */
export const formatCount = (n: number) => compact.format(n);

/** Parts for an event's calendar badge, in the event's own timezone: { month: "OCT", day: "31" }. */
export function eventDateBadge(iso: string, timeZone: string) {
  const d = new Date(iso);
  return {
    month: d.toLocaleDateString('en-US', { month: 'short', timeZone }).toUpperCase(),
    day: d.toLocaleDateString('en-US', { day: 'numeric', timeZone }),
  };
}

/**
 * When an event happens, in its own timezone: "Sat, Oct 31 · 8:00 AM – 11:00 AM CDT", or with both dates
 * when it runs past midnight.
 */
export function formatEventWhen(startsAt: string, endsAt: string | null, timeZone: string) {
  const start = new Date(startsAt);
  const date = (d: Date) =>
    d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', timeZone });
  const time = (d: Date, zone: boolean) =>
    d.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      timeZone,
      ...(zone ? { timeZoneName: 'short' } : {}),
    });
  if (!endsAt) return `${date(start)} · ${time(start, true)}`;
  const end = new Date(endsAt);
  if (date(start) === date(end))
    return `${date(start)} · ${time(start, false)} – ${time(end, true)}`;
  return `${date(start)}, ${time(start, false)} – ${date(end)}, ${time(end, true)}`;
}

/** Whether an event is over. No end time means 6 hours after it starts (the database uses the same rule). */
export function eventHasEnded(e: { starts_at: string; ends_at: string | null }, now = new Date()) {
  const end = e.ends_at
    ? new Date(e.ends_at)
    : new Date(new Date(e.starts_at).getTime() + 6 * 3_600_000);
  return end <= now;
}
