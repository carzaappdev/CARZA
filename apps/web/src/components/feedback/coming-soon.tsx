import type { LucideIcon } from 'lucide-react';

/** A tab that's on its way. Kept on-brand so the app still feels finished. */
export function ComingSoon({
  Icon,
  title,
  body,
}: {
  Icon: LucideIcon;
  title: string;
  body: string;
}) {
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col items-center justify-center gap-4 px-6 py-20 text-center sm:border-x">
      <span className="bg-brand-ink grid size-16 place-items-center rounded-2xl text-white shadow-lg">
        <Icon className="size-8" aria-hidden />
      </span>
      <h1 className="font-display text-2xl font-bold tracking-tight">{title}</h1>
      <p className="text-muted-foreground max-w-sm">{body}</p>
      <span className="bg-muted rounded-full px-3 py-1 text-xs font-semibold tracking-wide uppercase">
        Coming soon
      </span>
    </div>
  );
}
