'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { setBlocked } from '@/lib/actions/safety';
import { cn } from '@/lib/utils';

export function UnblockButton({
  userId,
  username,
  className,
}: {
  userId: string;
  username: string;
  className?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <div className={cn('flex flex-col gap-2', className)}>
      <p className="text-muted-foreground text-sm">
        You blocked @{username}. You won’t see each other’s posts, reels or events.
      </p>
      <Button
        variant="outline"
        className="w-full rounded-xl"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await setBlocked({ userId, blocked: false });
            if (!result.ok) {
              toast.error(result.error.message);
              return;
            }
            toast.success(`Unblocked @${username}`);
            router.refresh();
          })
        }
      >
        Unblock
      </Button>
    </div>
  );
}
