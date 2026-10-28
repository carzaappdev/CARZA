'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { UserAvatar } from '@/components/feed/user-avatar';
import { Button } from '@/components/ui/button';
import { setBlocked } from '@/lib/actions/safety';

type Blocked = { id: string; username: string; display_name: string; avatar_path: string | null };

/** Settings: the people you've blocked, each with Unblock. */
export function BlockedList({ initial }: { initial: Blocked[] }) {
  const [people, setPeople] = useState(initial);
  const [pending, startTransition] = useTransition();
  if (!people.length) {
    return <p className="text-muted-foreground text-sm">You haven’t blocked anyone.</p>;
  }
  return (
    <ul className="flex flex-col gap-1">
      {people.map((p) => (
        <li key={p.id} className="flex items-center gap-3 py-1.5">
          <UserAvatar name={p.display_name} path={p.avatar_path} className="size-10" />
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold">{p.display_name}</span>
            <span className="text-muted-foreground block truncate text-sm">@{p.username}</span>
          </span>
          <Button
            variant="outline"
            size="sm"
            className="rounded-full"
            disabled={pending}
            onClick={() =>
              startTransition(async () => {
                const result = await setBlocked({ userId: p.id, blocked: false });
                if (!result.ok) {
                  toast.error(result.error.message);
                  return;
                }
                setPeople((all) => all.filter((x) => x.id !== p.id));
                toast.success(`Unblocked @${p.username}`);
              })
            }
          >
            Unblock
          </Button>
        </li>
      ))}
    </ul>
  );
}
