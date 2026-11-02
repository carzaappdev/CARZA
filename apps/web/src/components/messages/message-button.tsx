'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { startConversation } from '@/lib/actions/messages';

/** Opens the DM thread with someone (creating it the first time). Signed out, it goes to sign-in. */
export function MessageButton({
  userId,
  signedIn,
  className,
}: {
  userId: string;
  signedIn: boolean;
  className?: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [pending, startTransition] = useTransition();

  if (!signedIn) {
    return (
      <Button asChild variant="outline" className={className}>
        <Link href={`/sign-in?next=${encodeURIComponent(pathname)}` as Route}>Message</Link>
      </Button>
    );
  }
  return (
    <Button
      type="button"
      variant="outline"
      className={className}
      disabled={pending}
      onClick={() =>
        startTransition(async () => {
          const result = await startConversation({ userId });
          if (!result.ok) {
            toast.error(result.error.message);
            return;
          }
          router.push(`/messages/${result.data.conversationId}` as Route);
        })
      }
    >
      {pending ? 'Opening…' : 'Message'}
    </Button>
  );
}
