import Link from 'next/link';
import { CarzaLogo, CarzaMark } from '@/components/brand/logo';
import { getUser } from '@/lib/auth';

export default async function HomePage() {
  const user = await getUser();
  return (
    <main className="bg-brand-ink relative flex min-h-dvh flex-col overflow-hidden text-white">
      <header className="relative z-10 flex items-center justify-between px-6 py-5 sm:px-10">
        <CarzaLogo tone="dark" size="sm" />
        {user ? (
          <Link
            href="/account"
            className="text-sm font-medium text-white/80 hover:text-white"
            data-testid="account-link"
          >
            Your account
          </Link>
        ) : (
          <Link href="/sign-in" className="text-sm font-medium text-white/80 hover:text-white">
            Sign in
          </Link>
        )}
      </header>

      <section className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-8 px-6 pb-20 text-center">
        <CarzaMark tone="dark" className="h-auto w-[min(560px,85vw)]" />
        <div className="flex flex-col gap-4">
          <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-6xl">
            Buy and sell cars, locally.
          </h1>
          <p className="mx-auto max-w-xl text-lg text-white/70">
            Local dealers and private sellers in one place. Message sellers, book test drives, and
            find the right car near you.
          </p>
        </div>
        {user ? (
          <Link
            href="/account"
            className="text-brand-ink h-12 rounded-full bg-white px-7 leading-[3rem] font-semibold hover:bg-white/90"
          >
            Go to your account
          </Link>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              href="/sign-up"
              className="text-brand-ink h-12 rounded-full bg-white px-7 leading-[3rem] font-semibold hover:bg-white/90"
            >
              Create your account
            </Link>
            <Link
              href="/sign-in"
              className="h-12 rounded-full border border-white/30 px-7 leading-[3rem] font-semibold hover:bg-white/10"
            >
              Sign in
            </Link>
          </div>
        )}
      </section>

      {/* Soft spotlight behind the car. */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-1/3 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-white/[0.06] blur-3xl"
      />
    </main>
  );
}
