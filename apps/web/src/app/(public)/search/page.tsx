import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { searchListings } from '@carza/db';
import {
  SEARCH_MAX_PAGE,
  SEARCH_PAGE_SIZE,
  hasLocation,
  matchVehicleQuery,
  parseSearchFilters,
  toSearchArgs,
  toSearchQuery,
  type SearchFilters as Filters,
} from '@carza/shared';
import { ListingCard } from '@/components/listings/listing-card';
import { SearchFilters } from '@/components/listings/search-filters';
import { SortSelect } from '@/components/listings/sort-select';
import { getCatalog } from '@/lib/catalog';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: 'Search cars',
  description: 'Search cars for sale from local dealers and private sellers.',
};

const href = (f: Filters, patch: Partial<Filters> = {}) => {
  const query = toSearchQuery(f, patch);
  return (query ? `/search?${query}` : '/search') as Route;
};

export default async function SearchPage({ searchParams }: PageProps<'/search'>) {
  const filters = parseSearchFilters(await searchParams);
  const { makes, models } = await getCatalog();

  // Free text from the header search box: turn it into make/model/year filters when we recognize it.
  if (filters.q !== undefined) {
    const match = matchVehicleQuery(filters.q, makes, models);
    if (match.make) {
      redirect(
        href(filters, {
          q: undefined,
          make: match.make.slug,
          model: match.model?.slug,
          yearMin: match.year ?? filters.yearMin,
          yearMax: match.year ?? filters.yearMax,
          page: undefined,
        }),
      );
    }
  }

  const make = makes.find((m) => m.slug === filters.make);
  const makeModels = make ? models.filter((m) => m.make_id === make.id) : [];
  const model = makeModels.find((m) => m.slug === filters.model);
  // Unknown slugs are ignored rather than matching nothing.
  const applied: Filters = { ...filters, make: make?.slug, model: model?.slug };

  const supabase = await createClient();
  const { rows, total } = await searchListings(
    supabase,
    toSearchArgs(applied, { makeId: make?.id, modelId: model?.id }),
  );

  const page = applied.page ?? 1;
  const lastPage = total ? Math.min(Math.ceil(total / SEARCH_PAGE_SIZE), SEARCH_MAX_PAGE) : 1;
  const heading = [make?.name, model?.name].filter(Boolean).join(' ') || 'Cars';

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <div className="grid gap-8 lg:grid-cols-[260px_1fr]">
        <aside aria-label="Filters">
          <SearchFilters
            key={toSearchQuery(applied)}
            filters={applied}
            makes={makes}
            models={makeModels}
          />
        </aside>

        <section aria-labelledby="results-heading" className="flex min-w-0 flex-col gap-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 id="results-heading" className="font-display text-2xl font-bold sm:text-3xl">
                {heading} for sale{hasLocation(applied) ? ' near you' : ''}
              </h1>
              <p className="text-muted-foreground mt-1 text-sm" aria-live="polite">
                {total === null
                  ? 'No more results'
                  : `${total.toLocaleString('en-US')} ${total === 1 ? 'car' : 'cars'}`}
              </p>
            </div>
            <SortSelect filters={applied} />
          </div>

          {applied.q !== undefined && (
            <p className="bg-muted rounded-md px-4 py-3 text-sm">
              We couldn’t match “{applied.q}” to a make or model, so here are all cars. Try a make
              like “Toyota” or a model like “Civic”.
            </p>
          )}

          {rows.length > 0 ? (
            <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {rows.map((listing) => (
                <li key={listing.listing_id} className="flex">
                  <ListingCard listing={listing} />
                </li>
              ))}
            </ul>
          ) : (
            <div className="border-border flex flex-col items-center gap-3 rounded-xl border border-dashed px-6 py-16 text-center">
              <h2 className="text-lg font-semibold">
                {total === null ? 'You’ve reached the end' : 'No cars match these filters'}
              </h2>
              <p className="text-muted-foreground max-w-sm text-sm">
                {total === null
                  ? 'There are no more results for this search.'
                  : 'Try a wider distance, a higher price, or fewer filters.'}
              </p>
              <Link
                href={total === null ? href(applied, { page: undefined }) : '/search'}
                className="bg-primary text-primary-foreground mt-2 h-10 rounded-md px-4 text-sm leading-10 font-semibold"
              >
                {total === null ? 'Back to the first page' : 'Clear all filters'}
              </Link>
            </div>
          )}

          {total !== null && lastPage > 1 && (
            <nav aria-label="Pages" className="flex items-center justify-between gap-4 text-sm">
              {page > 1 ? (
                <Link href={href(applied, { page: page - 1 })} className="font-medium underline">
                  Previous
                </Link>
              ) : (
                <span />
              )}
              <span className="text-muted-foreground">
                Page {page} of {lastPage}
              </span>
              {page < lastPage ? (
                <Link href={href(applied, { page: page + 1 })} className="font-medium underline">
                  Next
                </Link>
              ) : (
                <span />
              )}
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
