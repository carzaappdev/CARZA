import Link from 'next/link';
import { CarFrontIcon } from 'lucide-react';
import { CarzaMark } from '@/components/brand/logo';
import { EmptyState } from '@/components/feedback/empty-state';
import { Button } from '@/components/ui/button';
import { getViewer } from '@/lib/viewer';

export default async function HomePage() {
  const viewer = await getViewer();
  return (
    <>
      <section className="bg-brand-ink relative isolate overflow-hidden text-white">
        {/* Soft spotlight behind the car. */}
        <div
          aria-hidden
          className="pointer-events-none absolute top-1/3 left-1/2 -z-10 h-[420px] w-[900px] -translate-x-1/2 rounded-full bg-white/[0.06] blur-3xl"
        />
        <div className="mx-auto flex max-w-5xl flex-col items-center gap-8 px-6 py-16 text-center sm:py-24">
          <CarzaMark tone="dark" className="h-auto w-[min(480px,80vw)]" />
          <div className="flex flex-col gap-4">
            <h1 className="font-display text-4xl font-extrabold tracking-tight sm:text-6xl">
              Buy and sell cars, locally.
            </h1>
            <p className="mx-auto max-w-xl text-lg text-white/70">
              Local dealers and private sellers in one place. Message sellers, book test drives, and
              find the right car near you.
            </p>
          </div>
          <form action="/search" role="search" className="flex w-full max-w-lg gap-2">
            <label htmlFor="hero-search" className="sr-only">
              Search cars
            </label>
            <input
              id="hero-search"
              name="q"
              type="search"
              placeholder="Make, model or keyword"
              className="h-12 flex-1 rounded-full bg-white px-5 text-base text-neutral-900 outline-none placeholder:text-neutral-500 focus-visible:ring-[3px] focus-visible:ring-white/50"
            />
            <Button type="submit" size="lg" variant="secondary" className="h-12 rounded-full">
              Search
            </Button>
          </form>
          {viewer ? null : (
            <p className="text-sm text-white/70">
              New here?{' '}
              <Link
                href="/sign-up"
                className="font-semibold text-white underline-offset-4 hover:underline"
              >
                Create your account
              </Link>
            </p>
          )}
        </div>
      </section>

      <section className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-12 sm:px-6">
        <h2 className="font-display text-2xl font-bold tracking-tight">Recently listed near you</h2>
        <EmptyState
          Icon={CarFrontIcon}
          title="Listings are coming"
          body="Cars from dealers and private sellers near you will show up here."
          action={
            <Button asChild variant="outline">
              <Link href="/account/listings/new">Sell your car</Link>
            </Button>
          }
        />
      </section>
    </>
  );
}
