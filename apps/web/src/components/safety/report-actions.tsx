'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { resolveReport } from '@/lib/actions/moderation';

export function ReportActions({ reportId, canRemove }: { reportId: string; canRemove: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const run = (decision: 'remove' | 'dismiss') =>
    startTransition(async () => {
      if (decision === 'remove' && !window.confirm('Remove this for everyone?')) return;
      const result = await resolveReport({ reportId, decision });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      toast.success(decision === 'remove' ? 'Removed' : 'Dismissed');
      router.refresh();
    });
  return (
    <div className="ml-auto flex gap-2">
      <Button
        variant="outline"
        size="sm"
        className="rounded-full"
        disabled={pending}
        onClick={() => run('dismiss')}
      >
        Dismiss
      </Button>
      {canRemove ? (
        <Button
          variant="destructive"
          size="sm"
          className="rounded-full"
          disabled={pending}
          onClick={() => run('remove')}
        >
          Remove
        </Button>
      ) : null}
    </div>
  );
}
