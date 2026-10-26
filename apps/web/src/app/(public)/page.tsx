import type { Route } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { CarFrontIcon } from 'lucide-react';
import { CarzaMark } from '@/components/brand/logo';
import { EmptyState } from '@/components/feedback/empty-state';
import { Button } from '@/components/ui/button';
import { getListingInsights, getPostalCode, getSavedListingIds, searchListings } from '@carza/db';
import { BODY_STYLE_LABELS, DEFAULT_SEARCH_RADIUS_MILES } from '@carza/shared';
import { ListingCard } from '@/components/listings/listing-card';
import { getUser } from '@/lib/auth';
import { ZIP_COOKIE, validZip } from '@/lib/search';
import { createClient } from '@/lib/supabase/server';
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
              className="h-12 min-w-0 flex-1 rounded-full bg-white px-5 text-base text-neutral-900 outline-none placeholder:text-neutral-500 focus-visible:ring-[3px] focus-visible:ring-white/50"
            />
            <Button
              type="submit"
              size="lg"
              className="h-12 shrink-0 rounded-full bg-white text-neutral-900 hover:bg-white/90"
            >
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

      <RecentListings />

      <section
        aria-labelledby="browse-heading"
        className="mx-auto flex w-full max-w-7xl flex-col gap-4 px-4 pb-16 sm:px-6"
      >
        <h2 id="browse-heading" className="font-display text-2xl font-bold tracking-tight">
          Browse by type
        </h2>
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
          {BROWSE_BODY_STYLES.map((body) => (
            <li key={body}>
              <Link
                href={`/search?body=${body}` as Route}
                className="bg-card hover:bg-accent focus-visible:ring-ring/50 flex min-h-14 items-center justify-center rounded-xl border px-3 text-sm font-semibold outline-none focus-visible:ring-[3px]"
              >
                {BODY_STYLE_LABELS[body]}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </>
  );
}

const BROWSE_BODY_STYLES = [
  'suv',
  'pickup',
  'sedan',
  'crossover',
  'hatchback',
  'coupe',
  'minivan',
  'convertible',
] as const;

/** The newest cars, near the buyer's last searched ZIP code when we know it. */
async function RecentListings() {
  const supabase = await createClient();
  const zip = validZip((await cookies()).get(ZIP_COOKIE)?.value);
  const [user, postal] = await Promise.all([getUser(), zip ? getPostalCode(supabase, zip) : null]);
  const { rows } = await searchListings(supabase, {
    p_lat: postal?.lat,
    p_lng: postal?.lng,
    p_radius_miles: DEFAULT_SEARCH_RADIUS_MILES,
    p_limit: 8,
  });
  const ids = rows.map((r) => r.listing_id);
  const [insights, saved] = await Promise.all([
    getListingInsights(supabase, ids),
    user ? getSavedListingIds(supabase, ids) : Promise.resolve(new Set<string>()),
  ]);
  const near = postal ? (postal.city ? `${postal.city}, ${postal.region}` : postal.code) : null;
  const seeAll = (postal ? `/search?zip=${postal.code}` : '/search') as Route;

  return (
    <section
      aria-labelledby="recent-heading"
      className="mx-auto flex w-full max-w-7xl flex-col gap-6 px-4 py-12 sm:px-6"
    >
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id="recent-heading" className="font-display text-2xl font-bold tracking-tight">
          {near ? `Just listed near ${near}` : 'Just listed'}
        </h2>
        {rows.length > 0 && (
          <Link href={seeAll} className="text-sm font-medium underline-offset-4 hover:underline">
            See all cars
          </Link>
        )}
      </div>
      {rows.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {rows.map((listing) => (
            <li key={listing.listing_id} className="flex">
              <ListingCard
                listing={listing}
                insight={insights.get(listing.listing_id)}
                saved={saved.has(listing.listing_id)}
                signedIn={user !== null}
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          Icon={CarFrontIcon}
          title="No cars listed nearby yet"
          body="New cars from dealers and private sellers show up here as soon as they’re listed."
          action={
            <Button asChild variant="outline">
              <Link href="/search">Search everywhere</Link>
            </Button>
          }
        />
      )}
    </section>
  );
}
