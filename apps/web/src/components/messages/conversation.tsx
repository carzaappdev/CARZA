'use client';

import Link from 'next/link';
import { useEffect, useLayoutEffect, useRef, useState, useTransition } from 'react';
import { ArrowUpIcon, MoreHorizontalIcon } from 'lucide-react';
import { toast } from 'sonner';
import type { MessageView, PostAuthor } from '@carza/db';
import { LIMITS, formatMessageDivider, layoutMessages } from '@carza/shared';
import { UserAvatar } from '@/components/feed/user-avatar';
import { useSafetyActions } from '@/components/safety/use-safety-actions';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { loadMessages, markConversationRead, sendMessage } from '@/lib/actions/messages';
import { createClient } from '@/lib/supabase/browser';
import { cn } from '@/lib/utils';
import { MESSAGES_SEEN } from './inbox-button';

type Item = MessageView & { pending?: boolean };

const nearBottom = () =>
  window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 160;
const scrollToBottom = (smooth = false) =>
  window.scrollTo({
    top: document.documentElement.scrollHeight,
    behavior: smooth ? 'smooth' : 'instant',
  });

/** Adds messages that aren't already shown, keeping the thread in time order. */
function merge(current: Item[], incoming: MessageView[]) {
  const seen = new Set(current.map((m) => m.id));
  const added = incoming.filter((m) => !seen.has(m.id));
  if (!added.length) return current;
  return [...current, ...added].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/** A live 1:1 thread: messages arrive over Realtime, sends show instantly, and reading clears the badge. */
export function Conversation({
  conversationId,
  viewerId,
  other,
  initialMessages,
  initialHasOlder,
  canSend,
}: {
  conversationId: string;
  viewerId: string;
  other: PostAuthor;
  initialMessages: MessageView[];
  initialHasOlder: boolean;
  canSend: boolean;
}) {
  const [messages, setMessages] = useState<Item[]>(initialMessages);
  const [hasOlder, setHasOlder] = useState(initialHasOlder);
  const [loadingOlder, startLoadingOlder] = useTransition();
  const [selected, setSelected] = useState<string | null>(null);
  // Keeps the reader's place when older messages are added above.
  const anchor = useRef<number | null>(null);
  const stick = useRef(true);

  // Mark read now and whenever something new arrives while the thread is open.
  const markRead = useRef(() => {
    if (document.visibilityState !== 'visible') return;
    void markConversationRead({ conversationId }).then((r) => {
      if (r.ok) window.dispatchEvent(new Event(MESSAGES_SEEN));
    });
  });

  useLayoutEffect(() => {
    scrollToBottom();
  }, []);

  useLayoutEffect(() => {
    if (anchor.current !== null) {
      window.scrollTo({ top: document.documentElement.scrollHeight - anchor.current });
      anchor.current = null;
    } else if (stick.current) {
      scrollToBottom(true);
    }
  }, [messages]);

  useEffect(() => {
    const read = markRead.current;
    read();
    const supabase = createClient();
    // Catch up on anything missed while the tab was hidden or the socket was down.
    const catchUp = () => {
      if (document.visibilityState !== 'visible') return;
      void loadMessages({ conversationId, before: null }).then((r) => {
        if (!r.ok) return;
        stick.current = nearBottom();
        setMessages((current) => merge(current, r.data.messages));
        read();
      });
    };
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            sender_id: string | null;
            body: string;
            created_at: string;
          };
          const mine = row.sender_id === viewerId;
          stick.current = mine || nearBottom();
          setMessages((current) =>
            merge(
              // Our own send may still be showing as pending under a temporary id.
              mine ? current.filter((m) => !(m.pending && m.body === row.body)) : current,
              [{ id: row.id, senderId: row.sender_id, body: row.body, createdAt: row.created_at }],
            ),
          );
          if (!mine) read();
        },
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') catchUp();
      });
    document.addEventListener('visibilitychange', catchUp);
    return () => {
      document.removeEventListener('visibilitychange', catchUp);
      void supabase.removeChannel(channel);
    };
  }, [conversationId, viewerId]);

  function loadOlder() {
    const first = messages.find((m) => !m.pending);
    if (!first) return;
    startLoadingOlder(async () => {
      const result = await loadMessages({ conversationId, before: first.createdAt });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      anchor.current = document.documentElement.scrollHeight - window.scrollY;
      stick.current = false;
      setHasOlder(result.data.hasOlder);
      setMessages((current) => merge(current, result.data.messages));
    });
  }

  async function send(body: string) {
    const tempId = `pending-${crypto.randomUUID()}`;
    stick.current = true;
    setMessages((current) => [
      ...current,
      { id: tempId, senderId: viewerId, body, createdAt: new Date().toISOString(), pending: true },
    ]);
    const result = await sendMessage({ conversationId, body });
    if (!result.ok) {
      setMessages((current) => current.filter((m) => m.id !== tempId));
      toast.error(result.error.message);
      return false;
    }
    setMessages((current) =>
      merge(
        current.filter((m) => m.id !== tempId),
        [result.data],
      ),
    );
    return true;
  }

  const lastMine = messages.findLastIndex((m) => m.senderId === viewerId);

  return (
    <>
      <div className="flex flex-1 flex-col px-3 pt-3 pb-4">
        {hasOlder ? (
          <button
            type="button"
            onClick={loadOlder}
            disabled={loadingOlder}
            className="text-muted-foreground hover:text-foreground focus-visible:ring-ring/50 mx-auto mb-2 rounded-full px-4 py-2 text-sm font-medium outline-none focus-visible:ring-[3px]"
          >
            {loadingOlder ? 'Loading…' : 'Load earlier messages'}
          </button>
        ) : (
          <ThreadIntro other={other} />
        )}
        <ol aria-label={`Conversation with ${other.display_name}`} className="flex flex-col">
          {layoutMessages(messages).map((m, i) => {
            const mine = m.senderId === viewerId;
            const { divider, groupStart, groupEnd } = m;
            const isSelected = selected === m.id;
            return (
              <li key={m.id} className={cn('flex flex-col', groupStart && i > 0 && 'mt-3')}>
                {divider ? (
                  <p className="text-muted-foreground my-2 text-center text-xs font-medium">
                    {formatMessageDivider(m.createdAt)}
                  </p>
                ) : null}
                <div
                  className={cn(
                    'flex items-end gap-2',
                    mine ? 'justify-end pl-12' : 'pr-12',
                    !groupStart && 'mt-0.5',
                  )}
                >
                  {mine ? null : groupEnd ? (
                    <UserAvatar
                      name={other.display_name}
                      path={other.avatar_path}
                      className="size-7 shrink-0"
                    />
                  ) : (
                    <span className="w-7 shrink-0" aria-hidden />
                  )}
                  <button
                    type="button"
                    onClick={() => setSelected(isSelected ? null : m.id)}
                    aria-expanded={isSelected}
                    className={cn(
                      'focus-visible:ring-ring/50 max-w-full px-3.5 py-2 text-left text-[15px] leading-snug break-words whitespace-pre-wrap outline-none focus-visible:ring-[3px]',
                      mine ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
                      // Runs from one person share a flat inner edge, like iMessage.
                      mine
                        ? cn(
                            'rounded-l-[20px]',
                            groupStart ? 'rounded-tr-[20px]' : 'rounded-tr-md',
                            groupEnd ? 'rounded-br-[20px]' : 'rounded-br-md',
                          )
                        : cn(
                            'rounded-r-[20px]',
                            groupStart ? 'rounded-tl-[20px]' : 'rounded-tl-md',
                            groupEnd ? 'rounded-bl-[20px]' : 'rounded-bl-md',
                          ),
                      m.pending && 'opacity-70',
                    )}
                  >
                    {m.body}
                  </button>
                </div>
                {isSelected || (mine && i === lastMine && m.pending) ? (
                  <MessageDetails
                    message={m}
                    mine={mine}
                    other={other}
                    viewerId={viewerId}
                    onDone={() => setSelected(null)}
                  />
                ) : null}
              </li>
            );
          })}
        </ol>
      </div>
      {canSend ? <Composer onSend={send} /> : null}
    </>
  );
}

function ThreadIntro({ other }: { other: PostAuthor }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <UserAvatar name={other.display_name} path={other.avatar_path} large />
      <div>
        <p className="font-display text-lg font-semibold">{other.display_name}</p>
        <p className="text-muted-foreground text-sm">@{other.username}</p>
      </div>
      <Link
        href={`/u/${other.username}`}
        className="hover:bg-accent focus-visible:ring-ring/50 mt-1 rounded-full border px-4 py-1.5 text-sm font-semibold outline-none focus-visible:ring-[3px]"
      >
        View profile
      </Link>
    </div>
  );
}

/** Shown under a tapped message: when it was sent, and Report for the other person's messages. */
function MessageDetails({
  message,
  mine,
  other,
  viewerId,
  onDone,
}: {
  message: Item;
  mine: boolean;
  other: PostAuthor;
  viewerId: string;
  onDone: () => void;
}) {
  const safety = useSafetyActions({
    targetType: 'message',
    targetId: message.id,
    owner: other,
    viewerId: mine ? null : viewerId,
  });
  const time = new Date(message.createdAt).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
  return (
    <div
      className={cn(
        'text-muted-foreground mt-1 flex items-center gap-1 text-xs',
        mine ? 'justify-end' : 'pl-9',
      )}
    >
      <span>{message.pending ? 'Sending…' : time}</span>
      {safety.items ? (
        <>
          <DropdownMenu onOpenChange={(open) => !open && onDone()}>
            <DropdownMenuTrigger
              aria-label="More"
              className="hover:bg-accent hover:text-foreground focus-visible:ring-ring/50 grid size-8 place-items-center rounded-full outline-none focus-visible:ring-[3px]"
            >
              <MoreHorizontalIcon className="size-4" aria-hidden />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-56">
              {safety.items}
            </DropdownMenuContent>
          </DropdownMenu>
          {safety.dialog}
        </>
      ) : null}
    </div>
  );
}

function Composer({ onSend }: { onSend: (body: string) => Promise<boolean> }) {
  const [body, setBody] = useState('');
  const [, startTransition] = useTransition();
  const input = useRef<HTMLTextAreaElement>(null);
  const trimmed = body.trim();

  // Grow with the text, up to about six lines.
  useLayoutEffect(() => {
    const el = input.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  }, [body]);

  function submit() {
    if (!trimmed) return;
    setBody('');
    input.current?.focus();
    startTransition(async () => {
      const sent = await onSend(trimmed);
      // Give the text back so nothing is lost.
      if (!sent) setBody((current) => current || trimmed);
    });
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
      className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t px-3 py-2 backdrop-blur md:bottom-0"
    >
      <div className="bg-muted/60 focus-within:ring-ring/50 flex items-end gap-2 rounded-[22px] border py-1 pr-1 pl-4 focus-within:ring-[3px]">
        <label htmlFor="message-body" className="sr-only">
          Message
        </label>
        <textarea
          id="message-body"
          ref={input}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            // Enter sends, Shift+Enter adds a line. Ignore Enter while an IME is composing.
            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
          rows={1}
          maxLength={LIMITS.messageMaxLength}
          placeholder="Message…"
          enterKeyHint="send"
          className="placeholder:text-muted-foreground max-h-40 min-h-9 flex-1 resize-none bg-transparent py-2 text-[15px] leading-snug outline-none"
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!trimmed}
          className="bg-primary text-primary-foreground focus-visible:ring-ring/50 grid size-9 shrink-0 place-items-center rounded-full transition-opacity outline-none focus-visible:ring-[3px] disabled:opacity-40"
        >
          <ArrowUpIcon className="size-5" aria-hidden />
        </button>
      </div>
    </form>
  );
}
