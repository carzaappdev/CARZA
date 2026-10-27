'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { BanIcon, MoreHorizontalIcon, PencilIcon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cancelEvent } from '@/lib/actions/events';

/** Edit or cancel, for the event's host. */
export function HostMenu({ eventId }: { eventId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="size-12 rounded-xl"
          aria-label="Manage event"
          disabled={pending}
        >
          <MoreHorizontalIcon className="size-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem asChild>
          <Link href={`/events/${eventId}/edit` as Route}>
            <PencilIcon /> Edit event
          </Link>
        </DropdownMenuItem>
        <DropdownMenuItem
          className="text-destructive focus:text-destructive [&_svg]:text-destructive"
          onSelect={() => {
            if (
              !window.confirm(
                'Cancel this event? Everyone who RSVP’d will see it’s cancelled. This can’t be undone.',
              )
            )
              return;
            startTransition(async () => {
              const result = await cancelEvent({ eventId });
              if (!result.ok) {
                toast.error(result.error.message);
                return;
              }
              toast.success('Event cancelled');
              router.refresh();
            });
          }}
        >
          <BanIcon /> Cancel event
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
