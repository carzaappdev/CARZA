import type { Metadata, Route } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache, type ReactNode } from 'react';
import {
  CalendarIcon,
  CarFrontIcon,
  ChevronRightIcon,
  CogIcon,
  FuelIcon,
  GaugeIcon,
  PaletteIcon,
  PhoneIcon,
  StoreIcon,
  UserIcon,
  WaypointsIcon,
} from 'lucide-react';
import {
  getListing,
  getListingInsights,
  getSavedListingIds,
  searchListings,
  type ListingDetail,
} from '@carza/db';
import {
  BODY_STYLE_LABELS,
  CONDITION_LABELS,
  DRIVETRAIN_LABELS,
  FUEL_TYPE_LABELS,
  PRICE_RATINGS,
  PRICE_RATING_LABELS,
  TRANSMISSION_LABELS,
  defaultLoanTerms,
  formatMileage,
  formatPrice,
  listedAgo,
  monthlyPaymentCents,
  priceRating,
  setListingSavedSchema,
  vehicleTitle,
} from '@carza/shared';
import { ListingCard } from '@/components/listings/listing-card';
import { listingPhotoUrl } from '@/components/listings/listing-photo';
import { PaymentCalculator } from '@/components/listings/payment-calculator';
import { PhotoGallery } from '@/components/listings/photo-gallery';
import { PriceRatingBadge } from '@/components/listings/price-rating-badge';
import { SaveButton } from '@/components/listings/save-button';
import { ShareButton } from '@/components/listings/share-button';
import { Button } from '@/components/ui/button';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { cn } from '@/lib/utils';

// Shared by generateMetadata and the page, so the listing is fetched once per request.
const loadListing = cache(async (id: string) => {
  if (!setListingSavedSchema.shape.listingId.safeParse(id).success) return null;
  return getListing(await createClient(), id);
});

const titleOf = (l: ListingDetail) =>
  vehicleTitle({
    year: l.vehicle.year,
    make: l.vehicle.model.make.name,
    model: l.vehicle.model.name,
  });

const telHref = (phone: string) => `tel:${phone.replace(/[^\d+]/g, '')}`;

export async function generateMetadata({ params }: PageProps<'/listings/[id]'>): Promise<Metadata> {
  const listing = await loadListing((await params).id);
  if (!listing) return { title: 'Listing not found' };
  const trim = listing.vehicle.trim_level ? ` ${listing.vehicle.trim_level}` : '';
  const title = `${titleOf(listing)}${trim} · ${formatPrice(listing.price_cents)} · ${listing.city}, ${listing.region}`;
  const photo = listing.photos[0];
  return {
    title,
    description:
      listing.description?.slice(0, 160) ??
      `${formatMileage(listing.vehicle.mileage)}, for sale in ${listing.city}, ${listing.region}.`,
    // Drafts, sold and removed listings stay out of search engines.
    robots: listing.status === 'active' ? undefined : { index: false },
    alternates: { canonical: `/listings/${listing.id}` },
    openGraph: { title, images: photo ? [listingPhotoUrl(photo.storage_path)] : undefined },
  };
}

const STATUS_NOTICE: Partial<Record<ListingDetail['status'], string>> = {
  draft: 'This is a draft. It isn’t public until it’s published.',
  pending:
    'Sale pending: the seller has accepted an offer. Deals sometimes fall through, so you can still save it.',
  sold: 'This car has been sold. Similar cars still for sale are below.',
  removed: 'This listing was removed. It isn’t public anymore.',
};

export default async function ListingPage({ params }: PageProps<'/listings/[id]'>) {
  const listing = await loadListing((await params).id);
  if (!listing) notFound();

  const supabase = await createClient();
  const { vehicle, dealership, seller } = listing;
  const make = vehicle.model.make;
  const title = titleOf(listing);
  const fullTitle = `${title}${vehicle.trim_level ? ` ${vehicle.trim_level}` : ''}`;
  const forSale = listing.status === 'active' || listing.status === 'pending';
  const phone = forSale ? dealership?.phone : null;

  const [user, similar] = await Promise.all([getUser(), similarCars(listing)]);
  const ids = [listing.id, ...similar.map((s) => s.listing_id)];
  const [saved, insights] = await Promise.all([
    user ? getSavedListingIds(supabase, ids) : Promise.resolve(new Set<string>()),
    getListingInsights(supabase, ids),
  ]);
  const market = insights.get(listing.id);
  const monthly = monthlyPaymentCents(
    listing.price_cents,
    defaultLoanTerms(listing.price_cents, listing.condition === 'new'),
  );
  const searchMake = `/search?make=${make.slug}` as Route;
  const searchModel = `/search?make=${make.slug}&model=${vehicle.model.slug}` as Route;

  const facts = [
    { Icon: GaugeIcon, label: 'Mileage', value: formatMileage(vehicle.mileage) },
    { Icon: CalendarIcon, label: 'Year', value: String(vehicle.year) },
    {
      Icon: CarFrontIcon,
      label: 'Body style',
      value: vehicle.body_style && BODY_STYLE_LABELS[vehicle.body_style],
    },
    {
      Icon: FuelIcon,
      label: 'Fuel',
      value: vehicle.fuel_type && FUEL_TYPE_LABELS[vehicle.fuel_type],
    },
    {
      Icon: CogIcon,
      label: 'Transmission',
      value: vehicle.transmission && TRANSMISSION_LABELS[vehicle.transmission],
    },
    {
      Icon: WaypointsIcon,
      label: 'Drivetrain',
      value: vehicle.drivetrain && DRIVETRAIN_LABELS[vehicle.drivetrain],
    },
    { Icon: PaletteIcon, label: 'Exterior', value: vehicle.exterior_color },
    { Icon: PaletteIcon, label: 'Interior', value: vehicle.interior_color },
  ];
  const details: [string, string | null][] = [
    ['Make', make.name],
    ['Model', vehicle.model.name],
    ['Trim', vehicle.trim_level],
    ['Condition', CONDITION_LABELS[listing.condition]],
    ['VIN', vehicle.vin],
  ];
  const savedHere = saved.has(listing.id);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pt-4 pb-28 sm:px-6 lg:pt-6 lg:pb-12">
      <script
        type="application/ld+json"
        // JSON-LD for search engines. `<` is escaped so listing text can't close the script tag.
        dangerouslySetInnerHTML={{ __html: jsonLd(listing, fullTitle).replace(/</g, '\\u003c') }}
      />

      <nav aria-label="Breadcrumb" className="text-muted-foreground mb-4 text-sm">
        <ol className="flex flex-wrap items-center gap-1">
          <Crumb href="/search">Cars for sale</Crumb>
          <Crumb href={searchMake}>{make.name}</Crumb>
          <Crumb href={searchModel}>{vehicle.model.name}</Crumb>
          <li aria-current="page" className="text-foreground font-medium">
            {vehicle.year}
          </li>
        </ol>
      </nav>

      {STATUS_NOTICE[listing.status] && (
        <p role="status" className="bg-muted mb-4 rounded-lg px-4 py-3 text-sm font-medium">
          {STATUS_NOTICE[listing.status]}
        </p>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="min-w-0 lg:col-start-1">
          <PhotoGallery photos={listing.photos} title={fullTitle} />
        </div>

        {/* Phones: right after the photos. Desktop: a sticky right column. */}
        <aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <section className="bg-card rounded-2xl border p-5 sm:p-6" aria-label="Price and actions">
            <div className="flex min-h-6 flex-wrap items-center gap-2">
              {market?.marketPriceCents ? (
                <PriceRatingBadge
                  priceCents={listing.price_cents}
                  marketPriceCents={market.marketPriceCents}
                />
              ) : null}
              {listing.condition !== 'used' && (
                <span className="bg-secondary rounded-full px-2 py-0.5 text-xs font-semibold">
                  {CONDITION_LABELS[listing.condition]}
                </span>
              )}
            </div>
            <h1 className="font-display mt-3 text-2xl leading-tight font-bold tracking-tight">
              {title}
            </h1>
            {vehicle.trim_level && (
              <p className="text-muted-foreground mt-0.5">{vehicle.trim_level}</p>
            )}
            <p className="font-display mt-4 text-4xl font-extrabold tracking-tight">
              {formatPrice(listing.price_cents)}
            </p>
            {forSale && (
              <a
                href="#payments"
                className="text-muted-foreground mt-1 inline-block text-sm underline-offset-4 hover:underline"
              >
                Est. {formatPrice(monthly)}/mo with 10% down · Calculate
              </a>
            )}
            <p className="text-muted-foreground mt-3 text-sm">
              {formatMileage(vehicle.mileage)} · {listing.city}, {listing.region}
              {listing.published_at && ` · ${listedAgo(listing.published_at)}`}
            </p>
            <div className="mt-5 flex flex-col gap-2">
              {phone && (
                <Button asChild size="lg">
                  <a href={telHref(phone)}>
                    <PhoneIcon />
                    Call {phone}
                  </a>
                </Button>
              )}
              <div className="grid grid-cols-2 gap-2">
                <SaveButton
                  listingId={listing.id}
                  saved={savedHere}
                  signedIn={user !== null}
                  variant="button"
                  className="h-11"
                />
                <ShareButton title={fullTitle} className="h-11" />
              </div>
            </div>
          </section>

          <section
            className="bg-card rounded-2xl border p-5 sm:p-6"
            aria-labelledby="seller-heading"
          >
            <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
              {dealership ? 'Dealer' : 'Private seller'}
            </p>
            <div className="mt-2 flex items-center gap-3">
              <span className="bg-muted grid size-11 shrink-0 place-items-center rounded-full">
                {dealership ? (
                  <StoreIcon aria-hidden className="size-5" />
                ) : (
                  <UserIcon aria-hidden className="size-5" />
                )}
              </span>
              <div className="min-w-0">
                <h2 id="seller-heading" className="truncate font-semibold">
                  {dealership?.name ?? seller?.display_name}
                </h2>
                <p className="text-muted-foreground text-sm">
                  {dealership
                    ? `${dealership.city}, ${dealership.region}`
                    : `${listing.city}, ${listing.region}`}
                </p>
              </div>
            </div>
            {!dealership && (
              <p className="text-muted-foreground mt-4 text-sm">
                Private sale. Meet somewhere public, check the title matches the seller’s ID, and
                never pay before you’ve seen the car.
              </p>
            )}
          </section>
        </aside>

        <div className="flex min-w-0 flex-col gap-10 lg:col-start-1">
          <section aria-label="Key facts">
            <ul className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              {facts.map(({ Icon, label, value }) =>
                value ? (
                  <li key={label} className="bg-muted/50 flex flex-col gap-1 rounded-xl p-4">
                    <Icon aria-hidden className="text-muted-foreground size-5" />
                    <span className="text-muted-foreground mt-1 text-xs">{label}</span>
                    <span className="text-sm font-semibold">{value}</span>
                  </li>
                ) : null,
              )}
            </ul>
          </section>

          {market?.marketPriceCents ? (
            <PriceInsight
              priceCents={listing.price_cents}
              marketPriceCents={market.marketPriceCents}
              comparables={market.comparableCount}
              model={`${make.name} ${vehicle.model.name}`}
            />
          ) : null}

          {listing.description && (
            <Section id="description" title="From the seller">
              <p className="leading-relaxed whitespace-pre-line">{listing.description}</p>
            </Section>
          )}

          <Section id="details" title="Vehicle details">
            <dl className="grid gap-x-8 sm:grid-cols-2">
              {details.map(([label, value]) =>
                value ? (
                  <div key={label} className="flex justify-between gap-4 border-b py-3 text-sm">
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right font-medium break-all">{value}</dd>
                  </div>
                ) : null,
              )}
            </dl>
          </Section>

          {forSale && (
            <Section id="payments" title="Estimate your payment">
              <div className="bg-card max-w-xl rounded-2xl border p-5 sm:p-6">
                <PaymentCalculator
                  priceCents={listing.price_cents}
                  isNew={listing.condition === 'new'}
                />
              </div>
            </Section>
          )}
        </div>
      </div>

      {similar.length > 0 && (
        <section aria-labelledby="similar-heading" className="mt-14">
          <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
            <h2
              id="similar-heading"
              className="font-display text-xl font-bold tracking-tight sm:text-2xl"
            >
              Similar cars
            </h2>
            <Link
              href={searchModel}
              className="text-sm font-medium underline-offset-4 hover:underline"
            >
              See all {make.name} {vehicle.model.name}
            </Link>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {similar.map((s) => (
              <li key={s.listing_id} className="flex">
                <ListingCard
                  listing={s}
                  insight={insights.get(s.listing_id)}
                  saved={saved.has(s.listing_id)}
                  signedIn={user !== null}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Phones: price and the main actions stay in reach, just above the tab bar. */}
      <div className="bg-background/95 fixed inset-x-0 bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-30 border-t px-4 py-3 backdrop-blur md:bottom-0 lg:hidden">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <div className="min-w-0 flex-1">
            <p className="font-display truncate text-lg leading-tight font-bold">
              {formatPrice(listing.price_cents)}
            </p>
            <p className="text-muted-foreground truncate text-xs">{fullTitle}</p>
          </div>
          {phone && (
            <Button asChild>
              <a href={telHref(phone)}>
                <PhoneIcon />
                Call
              </a>
            </Button>
          )}
          <SaveButton
            listingId={listing.id}
            saved={savedHere}
            signedIn={user !== null}
            variant="button"
          />
        </div>
      </div>
    </div>
  );
}

/** Up to 4 other cars of the same model, topped up with the same body style. */
async function similarCars(listing: ListingDetail) {
  const supabase = await createClient();
  const { rows: sameModel } = await searchListings(supabase, {
    p_make_id: listing.vehicle.make_id,
    p_model_id: listing.vehicle.model_id,
    p_limit: 5,
  });
  let rows = sameModel.filter((r) => r.listing_id !== listing.id);
  if (rows.length < 4 && listing.vehicle.body_style) {
    const { rows: sameBody } = await searchListings(supabase, {
      p_body_styles: [listing.vehicle.body_style],
      p_limit: 8,
    });
    const seen = new Set([listing.id, ...rows.map((r) => r.listing_id)]);
    rows = [...rows, ...sameBody.filter((r) => !seen.has(r.listing_id))];
  }
  return rows.slice(0, 4);
}

function Crumb({ href, children }: { href: Route; children: ReactNode }) {
  return (
    <li className="flex items-center gap-1">
      <Link href={href} className="hover:text-foreground underline-offset-4 hover:underline">
        {children}
      </Link>
      <ChevronRightIcon aria-hidden className="size-3.5" />
    </li>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-24">
      <h2 id={`${id}-heading`} className="font-display mb-4 text-xl font-bold tracking-tight">
        {title}
      </h2>
      {children}
    </section>
  );
}

/** Where this price sits on the great → overpriced scale, and by how much. */
function PriceInsight({
  priceCents,
  marketPriceCents,
  comparables,
  model,
}: {
  priceCents: number;
  marketPriceCents: number;
  comparables: number;
  model: string;
}) {
  const { rating, differenceCents } = priceRating(priceCents, marketPriceCents);
  const diff = formatPrice(Math.abs(differenceCents));
  const verdict =
    Math.abs(differenceCents) < 25_000
      ? 'right at'
      : differenceCents > 0
        ? `${diff} below`
        : `${diff} above`;
  return (
    <Section id="price" title="Is this a good price?">
      <div className="bg-card rounded-2xl border p-5 sm:p-6">
        <PriceRatingBadge priceCents={priceCents} marketPriceCents={marketPriceCents} />
        <p className="mt-3 text-lg">
          Priced <strong>{verdict}</strong> our estimated market value of{' '}
          <strong>{formatPrice(marketPriceCents)}</strong>.
        </p>
        <ol className="mt-5 grid grid-cols-5 gap-1" aria-label="Price rating scale">
          {PRICE_RATINGS.map((r) => (
            <li
              key={r}
              className="flex flex-col gap-1.5"
              aria-current={r === rating ? 'true' : undefined}
            >
              <span className={cn('h-2 rounded-full', r === rating ? 'bg-primary' : 'bg-muted')} />
              <span
                className={cn(
                  'text-center text-[11px] leading-tight',
                  r === rating ? 'font-semibold' : 'text-muted-foreground',
                )}
              >
                {PRICE_RATING_LABELS[r]}
              </span>
            </li>
          ))}
        </ol>
        <p className="text-muted-foreground mt-4 text-xs">
          Based on {comparables} similar {model} listings (model years within 2 of this one,
          adjusted for mileage), including cars sold in the last year.
        </p>
      </div>
    </Section>
  );
}

function jsonLd(listing: ListingDetail, name: string) {
  const { vehicle } = listing;
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Car',
    name,
    brand: { '@type': 'Brand', name: vehicle.model.make.name },
    model: vehicle.model.name,
    vehicleModelDate: String(vehicle.year),
    mileageFromOdometer: { '@type': 'QuantitativeValue', value: vehicle.mileage, unitCode: 'SMI' },
    ...(vehicle.vin ? { vehicleIdentificationNumber: vehicle.vin } : {}),
    itemCondition:
      listing.condition === 'new'
        ? 'https://schema.org/NewCondition'
        : 'https://schema.org/UsedCondition',
    image: listing.photos.map((p) => listingPhotoUrl(p.storage_path)),
    offers: {
      '@type': 'Offer',
      price: (listing.price_cents / 100).toFixed(0),
      priceCurrency: 'USD',
      availability:
        listing.status === 'active'
          ? 'https://schema.org/InStock'
          : listing.status === 'sold'
            ? 'https://schema.org/SoldOut'
            : 'https://schema.org/LimitedAvailability',
    },
  });
}
