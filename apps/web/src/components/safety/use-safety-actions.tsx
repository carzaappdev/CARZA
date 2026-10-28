'use client';

import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { BanIcon, FlagIcon } from 'lucide-react';
import { toast } from 'sonner';
import { SOCIAL_REPORT_REASONS, type SocialReportTarget } from '@carza/shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { reportContent, setBlocked } from '@/lib/actions/safety';
import { cn } from '@/lib/utils';

const NOUN: Record<SocialReportTarget, string> = {
  post: 'post',
  reel: 'reel',
  event: 'event',
  user: 'account',
};

/**
 * "Report" and "Block" for someone else's post, reel, event or profile. Render `items` inside a
 * DropdownMenuContent and `dialog` anywhere outside it (the menu unmounts when it closes).
 * Both are null for your own content and when signed out.
 */
export function useSafetyActions({
  targetType,
  targetId,
  owner,
  viewerId,
  onBlocked,
}: {
  targetType: SocialReportTarget;
  targetId: string;
  owner: { id: string; username: string };
  viewerId: string | null;
  onBlocked?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [, startTransition] = useTransition();

  if (!viewerId || viewerId === owner.id) return { items: null, dialog: null };

  function block() {
    if (
      !window.confirm(
        `Block @${owner.username}? You won’t see each other’s posts, reels or events, and any follows between you are removed.`,
      )
    )
      return;
    startTransition(async () => {
      const result = await setBlocked({ userId: owner.id, blocked: true });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(`Blocked @${owner.username}`);
      if (onBlocked) onBlocked();
      else router.refresh();
    });
  }

  return {
    items: (
      <>
        <DropdownMenuItem onSelect={() => setOpen(true)}>
          <FlagIcon /> Report {NOUN[targetType]}
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive [&_svg]:text-destructive"
          onSelect={block}
        >
          <BanIcon /> Block @{owner.username}
        </DropdownMenuItem>
      </>
    ),
    dialog: (
      <ReportDialog
        open={open}
        onOpenChange={setOpen}
        targetType={targetType}
        targetId={targetId}
        onBlock={() => {
          setOpen(false);
          block();
        }}
        username={owner.username}
      />
    ),
  };
}

function ReportDialog({
  open,
  onOpenChange,
  targetType,
  targetId,
  username,
  onBlock,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  targetType: SocialReportTarget;
  targetId: string;
  username: string;
  onBlock: () => void;
}) {
  const [reason, setReason] = useState<(typeof SOCIAL_REPORT_REASONS)[number][0] | null>(null);
  const [details, setDetails] = useState('');
  const [sent, setSent] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit() {
    if (!reason) return;
    startTransition(async () => {
      const result = await reportContent({ targetType, targetId, reason, details });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      setSent(true);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setReason(null);
          setDetails('');
          setSent(false);
        }
      }}
    >
      <DialogContent>
        {sent ? (
          <>
            <DialogTitle>Thanks for letting us know</DialogTitle>
            <DialogDescription>
              We’ll review it. If you don’t want to see @{username} anymore, you can block them.
            </DialogDescription>
            <div className="flex flex-col gap-2 sm:flex-row-reverse">
              <Button className="rounded-full" onClick={() => onOpenChange(false)}>
                Done
              </Button>
              <Button variant="outline" className="rounded-full" onClick={onBlock}>
                Block @{username}
              </Button>
            </div>
          </>
        ) : (
          <>
            <DialogTitle>Report this {NOUN[targetType]}</DialogTitle>
            <DialogDescription>
              Reports are private. @{username} won’t know it was you.
            </DialogDescription>
            <fieldset className="flex flex-col gap-2">
              <legend className="sr-only">Reason</legend>
              {SOCIAL_REPORT_REASONS.map(([value, label]) => (
                <label
                  key={value}
                  className={cn(
                    'hover:bg-accent has-focus-visible:ring-ring/50 flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 text-[15px] has-focus-visible:ring-[3px]',
                    reason === value && 'border-foreground',
                  )}
                >
                  <input
                    type="radio"
                    name="reason"
                    value={value}
                    checked={reason === value}
                    onChange={() => setReason(value)}
                    className="accent-foreground size-4"
                  />
                  {label}
                </label>
              ))}
            </fieldset>
            <label className="flex flex-col gap-1.5 text-sm font-medium">
              Anything else? (optional)
              <textarea
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={2000}
                rows={3}
                className="border-input focus-visible:ring-ring/50 rounded-xl border bg-transparent px-3 py-2 text-[15px] font-normal outline-none focus-visible:ring-[3px]"
              />
            </label>
            <Button className="rounded-full" disabled={!reason || pending} onClick={submit}>
              {pending ? 'Sending…' : 'Send report'}
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
