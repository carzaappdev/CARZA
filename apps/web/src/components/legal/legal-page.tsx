import type { ReactNode } from 'react';
import Link from 'next/link';
import { LEGAL_LINKS, LEGAL_UPDATED } from './legal';

/** Shared frame for the policy pages: title, date, and links between them. */
export function LegalPage({
  title,
  intro,
  current,
  children,
}: {
  title: string;
  intro: string;
  current: string;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto flex w-full max-w-[720px] flex-col gap-8 px-4 pt-8 pb-32 md:pt-12">
      <nav aria-label="Policies" className="flex flex-wrap gap-2">
        {LEGAL_LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            aria-current={l.href === current ? 'page' : undefined}
            className="text-muted-foreground hover:text-foreground aria-[current=page]:bg-foreground aria-[current=page]:text-background rounded-full border px-3 py-1 text-sm font-medium transition-colors"
          >
            {l.label}
          </Link>
        ))}
      </nav>
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="text-muted-foreground text-sm">Last updated {LEGAL_UPDATED}</p>
        <p className="text-[17px] leading-relaxed">{intro}</p>
      </header>
      <div className="flex flex-col gap-8">{children}</div>
    </article>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="font-display text-xl font-semibold tracking-tight">{title}</h2>
      <div className="text-foreground/85 flex flex-col gap-3 text-[15px] leading-relaxed [&_a]:font-semibold [&_a]:underline [&_a]:underline-offset-4 [&_li]:pl-1 [&_ul]:flex [&_ul]:list-disc [&_ul]:flex-col [&_ul]:gap-1.5 [&_ul]:pl-5">
        {children}
      </div>
    </section>
  );
}
