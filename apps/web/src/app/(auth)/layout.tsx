import type { ReactNode } from 'react';
import { CarzaLogo, CarzaMark } from '@/components/brand/logo';

const POINTS = [
  'Dealer and private-seller cars, side by side',
  'Message sellers and book test drives in one place',
  'Search by distance from you, not just make and model',
];

function Check() {
  return (
    <span
      aria-hidden
      className="grid size-6 shrink-0 place-items-center rounded-full bg-white/10 ring-1 ring-white/15"
    >
      <svg
        viewBox="0 0 16 16"
        className="size-3.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
      >
        <path d="M3.5 8.5l3 3 6-7" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh grid-rows-[auto_1fr] lg:grid-cols-[1.05fr_1fr] lg:grid-rows-1">
      {/* Brand panel: a showroom spotlight on desktop, a slim logo bar on mobile. */}
      <aside className="bg-brand-ink relative isolate overflow-hidden text-white">
        {/* Spotlight + floor glow */}
        <div
          aria-hidden
          className="absolute inset-0 -z-10 hidden lg:block"
          style={{
            background:
              'radial-gradient(60% 45% at 50% 38%, rgba(255,255,255,0.14), transparent 70%), radial-gradient(45% 12% at 50% 62%, rgba(255,255,255,0.10), transparent 75%)',
          }}
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 -z-10 hidden h-1/3 bg-gradient-to-t from-black/60 to-transparent lg:block"
        />

        <div className="flex h-full flex-col px-6 py-5 lg:px-14 lg:py-12">
          <CarzaLogo tone="dark" size="md" />

          <div className="hidden flex-1 flex-col items-center justify-center gap-16 py-10 lg:flex">
            <div className="relative w-full max-w-[560px]">
              <CarzaMark
                tone="dark"
                className="h-auto w-full drop-shadow-[0_0_40px_rgba(255,255,255,0.18)]"
              />
              {/* Reflection on the showroom floor, clipped to a short strip under the car */}
              <div aria-hidden className="absolute top-full left-0 h-14 w-full overflow-hidden">
                <CarzaMark
                  tone="dark"
                  className="pointer-events-none h-auto w-full -scale-y-100 opacity-[0.07] [mask-image:linear-gradient(to_bottom,black,transparent_60%)]"
                />
              </div>
            </div>

            <div className="flex w-full max-w-md flex-col gap-7">
              <h2 className="font-display text-[2.6rem] leading-[1.08] font-bold tracking-tight">
                Your next car is
                <br />
                <span className="bg-gradient-to-r from-white to-white/55 bg-clip-text text-transparent">
                  closer than you think.
                </span>
              </h2>
              <ul className="flex flex-col gap-3.5 text-[15px] text-white/80">
                {POINTS.map((p) => (
                  <li key={p} className="flex items-center gap-3">
                    <Check />
                    {p}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <p className="hidden text-xs tracking-wide text-white/40 lg:block">
            © {new Date().getFullYear()} Carza · Buy and sell cars, locally.
          </p>
        </div>
      </aside>

      <main className="flex items-start justify-center bg-[#f7f7f5] px-4 py-10 sm:py-14 lg:items-center">
        <div className="w-full max-w-[420px] rounded-2xl bg-white p-7 shadow-[0_1px_2px_rgba(0,0,0,0.04),0_12px_40px_-12px_rgba(0,0,0,0.12)] ring-1 ring-black/5 sm:p-9">
          {children}
        </div>
      </main>
    </div>
  );
}
