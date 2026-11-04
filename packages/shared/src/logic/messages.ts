/** Messages closer together than this, from the same person, read as one group (one avatar, tight gaps). */
const GROUP_GAP_MS = 5 * 60 * 1000;
/** A gap longer than this gets a time divider above the next message. */
const DIVIDER_GAP_MS = 60 * 60 * 1000;

type Message = { id: string; senderId: string | null; createdAt: string };

export type MessageLayout = {
  /** First message of a run from one person. */
  groupStart: boolean;
  /** Last message of that run (gets the tail and, for the other person, their avatar). */
  groupEnd: boolean;
  /** Show a time divider before this message. */
  divider: boolean;
};

/** Lays out a thread (oldest first): where runs from one person start and end, and where time dividers go. */
export function layoutMessages<T extends Message>(messages: readonly T[]): (T & MessageLayout)[] {
  const time = (m: Message) => new Date(m.createdAt).getTime();
  // Whether `b` (right after `a`) needs a divider, and whether it continues a's run.
  const gap = (a: Message | undefined, b: Message | undefined) => {
    if (!a || !b) return { divider: true, joined: false };
    const ms = time(b) - time(a);
    const divider = ms >= DIVIDER_GAP_MS;
    return { divider, joined: !divider && a.senderId === b.senderId && ms < GROUP_GAP_MS };
  };
  return messages.map((m, i) => {
    const before = gap(messages[i - 1], m);
    const after = gap(m, messages[i + 1]);
    return { ...m, divider: before.divider, groupStart: !before.joined, groupEnd: !after.joined };
  });
}

/** Divider text: "Today 3:04 PM", "Yesterday 9:12 AM", "Mon 9:12 AM", or "Mar 4, 9:12 AM". */
export function formatMessageDivider(iso: string, now: Date = new Date()) {
  const then = new Date(iso);
  const time = then.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((startOfDay(now) - startOfDay(then)) / 86_400_000);
  if (days <= 0) return `Today ${time}`;
  if (days === 1) return `Yesterday ${time}`;
  if (days < 7) return `${then.toLocaleDateString('en-US', { weekday: 'short' })} ${time}`;
  const date = then.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    ...(then.getFullYear() === now.getFullYear() ? {} : { year: 'numeric' }),
  });
  return `${date}, ${time}`;
}
