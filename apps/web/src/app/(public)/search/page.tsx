import type { Metadata, Route } from 'next';
import { cookies } from 'next/headers';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { cache } from 'react';
import { SearchXIcon, XIcon } from 'lucide-react';
import { getListingInsights, getPostalCode, getSavedListingIds, searchListings } from '@carza/db';
import {
  SEARCH_MAX_PAGE,
  SEARCH_PAGE_SIZE,
  filterChips,
  hasLocation,
  matchVehicleQuery,
  parseSearchFilters,
  searchHref,
  toSearchArgs,
  type SearchFilters as Filters,
} from '@carza/shared';
import { EmptyState } from '@/components/feedback/empty-state';
import { ListingCard } from '@/components/listings/listing-card';
import { MobileFilters } from '@/components/listings/mobile-filters';
import { SearchFilters } from '@/components/listings/search-filters';
import { SortSelect } from '@/components/listings/sort-select';
import { Button } from '@/components/ui/button';
import { getUser } from '@/lib/auth';
import { getCatalog } from '@/lib/catalog';
import { ZIP_COOKIE, validZip } from '@/lib/search';
import { createClient } from '@/lib/supabase/server';

const href = (f: Filters, patch: Partial<Filters> = {}) => searchHref(f, patch) as Route;

/** Everything the page and its metadata need, resolved from the URL. Cached per request. */
const resolveSearch = cache(async (query: string) => {
  const filters = parseSearchFilters(JSON.parse(query) as Record<string, unknown>);
  const { makes, models } = await getCatalog();
  const make = makes.find((m) => m.slug === filters.make);
  const makeModels = make ? models.filter((m) => m.make_id === make.id) : [];
  const model = makeModels.find((m) => m.slug === filters.model);
  const postal = filters.zip ? await getPostalCode(await createClient(), filters.zip) : null;
  const located = postal !== null || (filters.lat !== undefined && filters.lng !== undefined);
  // Unknown slugs and ZIP codes are dropped rather than matching nothing; "closest first" needs a location.
  const applied: Filters = {
    ...filters,
    make: make?.slug,
    model: model?.slug,
    zip: postal?.code,
    sort: filters.sort === 'distance' && !located ? undefined : filters.sort,
  };
  const place = postal
    ? postal.city
      ? `${postal.city}, ${postal.region} ${postal.code}`
      : postal.code
    : applied.lat !== undefined
      ? 'your location'
      : undefined;
  const heading = [make?.name, model?.name].filter(Boolean).join(' ') || 'Cars';
  return { filters, applied, makes, models, makeModels, make, model, postal, place, heading };
});

export async function generateMetadata({ searchParams }: PageProps<'/search'>): Promise<Metadata> {
  const { heading, place, postal } = await resolveSearch(JSON.stringify(await searchParams));
  const near = postal?.city ? ` near ${postal.city}, ${postal.region}` : '';
  return {
    title: `${heading} for sale${near}`,
    description: `Shop ${heading.toLowerCase()} for sale${place && postal ? ` near ${place}` : ''} from local dealers and private sellers, with price ratings on every car.`,
  };
}

export default async function SearchPage({ searchParams }: PageProps<'/search'>) {
  const resolved = await resolveSearch(JSON.stringify(await searchParams));
  const { filters, applied, makes, models, makeModels, make, model, postal, place, heading } =
    resolved;

  // Free text from the header search box: turn it into make/model/year filters when we recognize it,
  // and start near the buyer's remembered ZIP code.
  if (filters.q !== undefined) {
    const match = matchVehicleQuery(filters.q, makes, models);
    if (match.make) {
      redirect(
        href(applied, {
          q: undefined,
          make: match.make.slug,
          model: match.model?.slug,
          yearMin: match.year ?? applied.yearMin,
          yearMax: match.year ?? applied.yearMax,
          zip: hasLocation(applied)
            ? applied.zip
            : validZip((await cookies()).get(ZIP_COOKIE)?.value),
          page: undefined,
        }),
      );
    }
  }

  const supabase = await createClient();
  const [user, { rows, total }] = await Promise.all([
    getUser(),
    searchListings(
      supabase,
      toSearchArgs(applied, {
        makeId: make?.id,
        modelId: model?.id,
        origin: postal ? { lat: postal.lat, lng: postal.lng } : undefined,
      }),
    ),
  ]);
  const ids = rows.map((r) => r.listing_id);
  const [insights, saved] = await Promise.all([
    getListingInsights(supabase, ids),
    user ? getSavedListingIds(supabase, ids) : Promise.resolve(new Set<string>()),
  ]);

  const page = applied.page ?? 1;
  const lastPage = total ? Math.min(Math.ceil(total / SEARCH_PAGE_SIZE), SEARCH_MAX_PAGE) : 1;
  const chips = filterChips(applied, { make: make?.name, model: model?.name, place });
  const filterProps = { filters: applied, makes, models: makeModels };
  const unknownZip = filters.zip !== undefined && !postal;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 lg:py-8">
      <div className="grid gap-8 lg:grid-cols-[280px_1fr]">
        <aside aria-label="Filters" className="hidden lg:block">
          <div className="sticky top-20 max-h-[calc(100dvh-6rem)] overflow-y-auto pr-2">
            <SearchFilters key={href(applied)} {...filterProps} autoApply idPrefix="d" />
          </div>
        </aside>

        <section aria-labelledby="results-heading" className="flex min-w-0 flex-col gap-5">
          <header className="flex flex-col gap-4">
            <div>
              <h1
                id="results-heading"
                className="font-display text-2xl font-bold tracking-tight sm:text-3xl"
              >
                {heading} for sale
                {place && <span className="text-muted-foreground"> near {place}</span>}
              </h1>
              <p className="text-muted-foreground mt-1 text-sm" aria-live="polite">
                {total === null
                  ? 'No more results'
                  : `${total.toLocaleString('en-US')} ${total === 1 ? 'match' : 'matches'}`}
                {total ? ' · Price ratings compare each car with similar ones' : ''}
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <MobileFilters key={href(applied)} {...filterProps} activeCount={chips.length} />
              <SortSelect filters={applied} located={place !== undefined} />
            </div>

            {chips.length > 0 && (
              <ul className="flex flex-wrap items-center gap-2" aria-label="Active filters">
                {chips.map((chip) => (
                  <li key={chip.key}>
                    <Link
                      href={href(applied, chip.remove)}
                      scroll={false}
                      className="bg-secondary text-secondary-foreground hover:bg-accent focus-visible:ring-ring/50 inline-flex min-h-9 items-center gap-1.5 rounded-full py-1 pr-2 pl-3 text-sm font-medium outline-none focus-visible:ring-[3px]"
                    >
                      {chip.label}
                      <XIcon aria-hidden className="size-4 opacity-70" />
                      <span className="sr-only">(remove filter)</span>
                    </Link>
                  </li>
                ))}
                <li>
                  <Link
                    href="/search"
                    className="text-muted-foreground hover:text-foreground px-2 text-sm font-medium underline-offset-4 hover:underline"
                  >
                    Clear all
                  </Link>
                </li>
              </ul>
            )}
          </header>

          {(unknownZip || applied.q !== undefined) && (
            <p role="status" className="bg-muted rounded-lg px-4 py-3 text-sm">
              {unknownZip
                ? `We don’t recognize the ZIP code ${filters.zip}, so we’re showing cars everywhere.`
                : `We couldn’t match “${applied.q}” to a make or model, so here are all cars. Try a make like “Toyota” or a model like “Civic”.`}
            </p>
          )}

          {rows.length > 0 ? (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((listing, i) => (
                <li key={listing.listing_id} className="flex">
                  <ListingCard
                    listing={listing}
                    insight={insights.get(listing.listing_id)}
                    saved={saved.has(listing.listing_id)}
                    signedIn={user !== null}
                    priority={i < 3}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              Icon={SearchXIcon}
              title={total === null ? 'You’ve reached the end' : 'No cars match these filters'}
              body={
                total === null
                  ? 'There are no more results for this search.'
                  : chips.length > 0
                    ? 'Try a wider distance, a higher price, or remove a filter or two.'
                    : 'Check back soon. New cars are listed every day.'
              }
              action={
                <Button asChild>
                  <Link href={total === null ? href(applied, { page: undefined }) : '/search'}>
                    {total === null ? 'Back to the first page' : 'Clear all filters'}
                  </Link>
                </Button>
              }
            />
          )}

          {total !== null && lastPage > 1 && (
            <Pagination page={page} lastPage={lastPage} link={(p) => href(applied, { page: p })} />
          )}
        </section>
      </div>
    </div>
  );
}

/** Previous / numbered pages around the current one / Next. */
function Pagination({
  page,
  lastPage,
  link,
}: {
  page: number;
  lastPage: number;
  link: (page: number) => Route;
}) {
  const nearby = [1, page - 1, page, page + 1, lastPage].filter(
    (p, i, all) => p >= 1 && p <= lastPage && all.indexOf(p) === i,
  );
  nearby.sort((a, b) => a - b);
  const item =
    'focus-visible:ring-ring/50 grid min-h-11 min-w-11 place-items-center rounded-lg px-3 text-sm font-medium outline-none focus-visible:ring-[3px]';
  return (
    <nav aria-label="Pages" className="flex items-center justify-center gap-1 pt-4">
      {page > 1 && (
        <Link href={link(page - 1)} className={`${item} hover:bg-accent`}>
          Previous
        </Link>
      )}
      {nearby.map((p, i) => (
        <span key={p} className="flex items-center gap-1">
          {i > 0 && p - (nearby[i - 1] ?? p) > 1 && (
            <span aria-hidden className="text-muted-foreground px-1">
              …
            </span>
          )}
          {p === page ? (
            <span aria-current="page" className={`${item} bg-primary text-primary-foreground`}>
              {p}
            </span>
          ) : (
            <Link href={link(p)} className={`${item} hover:bg-accent`} aria-label={`Page ${p}`}>
              {p}
            </Link>
          )}
        </span>
      ))}
      {page < lastPage && (
        <Link href={link(page + 1)} className={`${item} hover:bg-accent`}>
          Next
        </Link>
      )}
    </nav>
  );
}
