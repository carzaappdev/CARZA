import type { ReactNode } from 'react';
import { CarzaLogo, CarzaMark } from '@/components/brand/logo';

const POINTS = [
  'Cars from local dealers and private sellers, side by side',
  'Message sellers and book test drives in one place',
  'Search by distance from you, not just by make and model',
];

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr] lg:grid-cols-[1.1fr_1fr] lg:grid-rows-1">
      {/* Brand panel: a full-height column on desktop, a compact band on mobile. */}
      <aside className="bg-brand-ink relative overflow-hidden text-white">
        <div className="relative z-10 flex flex-col gap-4 px-6 py-6 lg:h-full lg:justify-between lg:px-12 lg:py-12">
          <CarzaLogo tone="dark" size="md" />
          <div className="hidden max-w-md flex-col gap-6 lg:flex">
            <h2 className="font-display text-4xl leading-tight font-bold">
              Your next car is closer than you think.
            </h2>
            <ul className="flex flex-col gap-3 text-white/75">
              {POINTS.map((p) => (
                <li key={p} className="flex gap-3">
                  <span aria-hidden className="mt-2 size-1.5 shrink-0 rounded-full bg-white" />
                  {p}
                </li>
              ))}
            </ul>
          </div>
          <p className="hidden text-sm text-white/50 lg:block">
            © {new Date().getFullYear()} Carza
          </p>
        </div>
        {/* Oversized mark as a background flourish. */}
        <CarzaMark
          tone="dark"
          className="pointer-events-none absolute -right-24 bottom-10 hidden h-auto w-[640px] opacity-[0.07] lg:block"
        />
      </aside>

      <main className="flex items-start justify-center px-4 py-10 lg:items-center">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
