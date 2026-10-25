import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

/** What a list or page shows when there's nothing in it yet. Every list page renders one. */
export function EmptyState({
  Icon,
  title,
  body,
  action,
}: {
  Icon: LucideIcon;
  title: string;
  body?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-14 text-center">
      <span className="bg-muted grid size-12 place-items-center rounded-full">
        <Icon className="text-muted-foreground size-6" aria-hidden />
      </span>
      <h2 className="font-display text-lg font-semibold">{title}</h2>
      {body ? <p className="text-muted-foreground max-w-sm text-sm">{body}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
