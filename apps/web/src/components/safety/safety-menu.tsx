'use client';

import { MoreHorizontalIcon } from 'lucide-react';
import type { SocialReportTarget } from '@carza/shared';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { useSafetyActions } from './use-safety-actions';

/** A "More" button with Report and Block, for someone else's event or profile. */
export function SafetyMenu({
  className,
  ...props
}: {
  targetType: SocialReportTarget;
  targetId: string;
  owner: { id: string; username: string };
  viewerId: string | null;
  className?: string;
}) {
  const safety = useSafetyActions(props);
  if (!safety.items) return null;
  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label="More"
          className={cn(
            'text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/50 grid size-11 shrink-0 place-items-center rounded-full outline-none focus-visible:ring-[3px]',
            className,
          )}
        >
          <MoreHorizontalIcon className="size-5" aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {safety.items}
        </DropdownMenuContent>
      </DropdownMenu>
      {safety.dialog}
    </>
  );
}
