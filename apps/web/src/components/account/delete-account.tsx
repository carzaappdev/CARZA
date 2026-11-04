'use client';

import { useState, useTransition } from 'react';
import { Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { deleteConfirmationMatches } from '@carza/shared';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { deleteAccount } from '@/lib/actions/account';

/** Settings: permanently delete the account, confirmed by typing the username. */
export function DeleteAccount({ username }: { username: string }) {
  const [typed, setTyped] = useState('');
  const [pending, startTransition] = useTransition();
  const matches = deleteConfirmationMatches(typed, username);

  return (
    <Dialog onOpenChange={(open) => (open ? null : setTyped(''))}>
      <DialogTrigger asChild>
        <Button variant="outline" className="text-destructive self-start rounded-xl">
          Delete account
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogTitle>Delete your account?</DialogTitle>
        <DialogDescription>
          This permanently deletes your profile, posts, replies, reels, events you host, RSVPs,
          garage, follows and photos. It can’t be undone. Download your data first if you want a
          copy.
        </DialogDescription>
        <form
          className="flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault();
            if (!matches) return;
            startTransition(async () => {
              const result = await deleteAccount({ confirm: typed });
              // Success redirects away; only failures come back.
              if (result && !result.ok) toast.error(result.error.message);
            });
          }}
        >
          <label className="flex flex-col gap-1.5 text-sm font-medium">
            Type <span className="font-mono">@{username}</span> to confirm
            <input
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              autoCapitalize="none"
              autoCorrect="off"
              autoComplete="off"
              spellCheck={false}
              className="bg-background focus-visible:ring-ring/50 h-11 w-full rounded-lg border px-3 text-[15px] font-normal outline-none focus-visible:ring-[3px]"
            />
          </label>
          <div className="flex justify-end gap-2">
            <DialogClose asChild>
              <Button type="button" variant="ghost" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <Button type="submit" variant="destructive" disabled={!matches || pending}>
              {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
              Delete forever
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
