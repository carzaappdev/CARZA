'use client';

import { useEffect, useState } from 'react';
import { mentionAtCaret } from '@carza/shared';
import { suggestMentions, type MentionSuggestion } from '@/lib/actions/posts';
import { cn } from '@/lib/utils';
import { UserAvatar } from './user-avatar';

/**
 * @mention suggestions while typing. Call `update` with the text and caret after every change; `onKeyDown`
 * handles arrows, Enter/Tab and Escape (returns true when it used the key); `pick` returns the new text and caret.
 */
export function useMentionSuggest() {
  const [token, setToken] = useState<{ start: number; end: number; query: string } | null>(null);
  const [people, setPeople] = useState<MentionSuggestion[]>([]);
  const [active, setActive] = useState(0);

  useEffect(() => {
    if (!token) return;
    let stale = false;
    const timer = setTimeout(async () => {
      const result = await suggestMentions(token.query);
      if (stale) return;
      setPeople(result.ok ? result.data : []);
      setActive(0);
    }, 150);
    return () => {
      stale = true;
      clearTimeout(timer);
    };
  }, [token]);

  const open = token !== null && people.length > 0;

  return {
    open,
    people,
    active,
    update(text: string, caret: number) {
      const next = mentionAtCaret(text, caret);
      if (!next) {
        setToken(null);
        setPeople([]);
        return;
      }
      setToken((t) => (t?.query === next.query && t.end === next.end ? t : next));
    },
    close() {
      setToken(null);
      setPeople([]);
    },
    /** The text with the token replaced by "@username ", and where the caret goes. */
    pick(text: string, username: string) {
      if (!token) return null;
      const insert = `@${username} `;
      setToken(null);
      setPeople([]);
      return {
        text: text.slice(0, token.start) + insert + text.slice(token.end).replace(/^ /, ''),
        caret: token.start + insert.length,
      };
    },
    move(delta: number) {
      setActive((i) => (i + delta + people.length) % people.length);
    },
  };
}

export function MentionList({
  id,
  people,
  active,
  onPick,
}: {
  id: string;
  people: MentionSuggestion[];
  active: number;
  onPick: (username: string) => void;
}) {
  return (
    <ul
      id={id}
      role="listbox"
      aria-label="People to mention"
      className="bg-popover text-popover-foreground absolute inset-x-0 top-full z-40 mt-1 overflow-hidden rounded-xl border shadow-lg"
    >
      {people.map((p, i) => (
        <li key={p.username} role="option" aria-selected={i === active}>
          <button
            type="button"
            // Keep focus in the textarea so typing carries on.
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onPick(p.username)}
            className={cn(
              'flex w-full items-center gap-3 px-3 py-2 text-left',
              i === active ? 'bg-accent' : 'hover:bg-accent/60',
            )}
          >
            <UserAvatar name={p.displayName} path={p.avatarPath} className="size-8" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold">{p.displayName}</span>
              <span className="text-muted-foreground block truncate text-xs">@{p.username}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
