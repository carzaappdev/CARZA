'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import type { ReportDecision } from '@carza/shared';
import { Button } from '@/components/ui/button';
import { resolveReport, setSuspended } from '@/lib/actions/moderation';

const CONFIRM: Record<ReportDecision, string | null> = {
  dismiss: null,
  remove: 'Remove this for everyone?',
  suspend:
    'Suspend this account? They’ll be signed out and everything they posted will be hidden until you lift it.',
  escalate:
    'Escalate for child safety? The account is suspended and everything it uploaded is moved out of public view and kept as evidence. Nothing is deleted. You must then report it to NCMEC.',
  delete_account:
    'Delete this account and everything in it for good? Use this for a child under 13. It can’t be undone.',
};
const DONE: Record<ReportDecision, string> = {
  dismiss: 'Dismissed',
  remove: 'Removed',
  suspend: 'Account suspended',
  escalate: 'Escalated. Now file the NCMEC report.',
  delete_account: 'Account deleted',
};

export function ReportActions({
  reportId,
  canRemove,
  canEscalate,
  canDeleteAccount,
}: {
  reportId: string;
  canRemove: boolean;
  canEscalate: boolean;
  canDeleteAccount: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (decision: ReportDecision) =>
    startTransition(async () => {
      const question = CONFIRM[decision];
      if (question && !window.confirm(question)) return;
      const result = await resolveReport({ reportId, decision });
      if (!result.ok) toast.error(result.error.message, { duration: 15000 });
      else toast.success(result.data.info ?? DONE[decision], { duration: 10000 });
      router.refresh();
    });
  const button = (
    decision: ReportDecision,
    label: string,
    variant: 'outline' | 'destructive' = 'outline',
  ) => (
    <Button
      variant={variant}
      size="sm"
      className="rounded-full"
      disabled={pending}
      onClick={() => run(decision)}
    >
      {label}
    </Button>
  );
  return (
    <div className="ml-auto flex flex-wrap justify-end gap-2">
      {button('dismiss', 'Dismiss')}
      {button('suspend', 'Suspend account')}
      {canRemove ? button('remove', 'Remove', 'destructive') : null}
      {canEscalate ? button('escalate', 'Escalate', 'destructive') : null}
      {canDeleteAccount ? button('delete_account', 'Delete account', 'destructive') : null}
    </div>
  );
}

export function UnsuspendButton({ userId }: { userId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <Button
      variant="outline"
      size="sm"
      className="rounded-full"
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          if (!window.confirm('Lift this suspension? Their posts become visible again.')) return;
          const result = await setSuspended({ userId, suspended: false });
          if (!result.ok) toast.error(result.error.message);
          else toast.success('Suspension lifted');
          router.refresh();
        })
      }
    >
      Lift suspension
    </Button>
  );
}
