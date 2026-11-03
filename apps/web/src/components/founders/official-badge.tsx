import { BadgeCheckIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

/** The check next to the official Carza account's name. Nobody else can get it. */
export function OfficialBadge({ official, className }: { official: boolean; className?: string }) {
  if (!official) return null;
  return (
    <BadgeCheckIcon
      role="img"
      aria-label="Official Carza account"
      className={cn('text-primary inline size-4 shrink-0 self-center', className)}
    >
      <title>Official Carza account</title>
    </BadgeCheckIcon>
  );
}
