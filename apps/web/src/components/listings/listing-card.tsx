import Link from 'next/link';
import { CameraIcon } from 'lucide-react';
import type { ListingInsight, ListingSummary } from '@carza/db';
import {
  CONDITION_LABELS,
  defaultLoanTerms,
  formatDistance,
  formatMileage,
  formatPrice,
  listedAgo,
  monthlyPaymentCents,
  vehicleTitle,
} from '@carza/shared';
import { ListingPhoto } from './listing-photo';
import { PriceRatingBadge } from './price-rating-badge';
import { SaveButton } from './save-button';

const STATUS_BADGE: Partial<Record<NonNullable<ListingSummary['status']>, string>> = {
  pending: 'Sale pending',
  sold: 'Sold',
};

export function ListingCard({
  listing,
  insight,
  saved = false,
  signedIn,
  priority = false,
}: {
  listing: ListingSummary;
  insight?: ListingInsight;
  saved?: boolean;
  signedIn: boolean;
  priority?: boolean;
}) {
  const title = vehicleTitle({
    year: listing.year,
    make: listing.make_name,
    model: listing.model_name,
  });
  const monthly = monthlyPaymentCents(
    listing.price_cents,
    defaultLoanTerms(listing.price_cents, listing.condition === 'new'),
  );
  const status = listing.status && STATUS_BADGE[listing.status];
  const badge =
    status ?? (listing.condition !== 'used' ? CONDITION_LABELS[listing.condition] : null);

  return (
    <article className="group bg-card text-card-foreground relative flex w-full flex-col overflow-hidden rounded-2xl border transition-shadow hover:shadow-lg">
      <div className="bg-muted relative aspect-[4/3] overflow-hidden">
        <div className="absolute inset-0 transition-transform duration-300 group-hover:scale-[1.03]">
          <ListingPhoto
            path={listing.photo_path}
            alt={title}
            sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
            priority={priority}
          />
        </div>
        {badge && (
          <span className="bg-background/95 absolute top-3 left-3 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm">
            {badge}
          </span>
        )}
        {insight && insight.photoCount > 1 && (
          <span className="absolute bottom-3 left-3 inline-flex items-center gap-1 rounded-full bg-black/60 px-2 py-0.5 text-xs font-medium text-white">
            <CameraIcon aria-hidden className="size-3.5" />
            {insight.photoCount}
            <span className="sr-only">photos</span>
          </span>
        )}
        <SaveButton
          listingId={listing.listing_id}
          saved={saved}
          signedIn={signedIn}
          className="absolute top-2 right-2 z-10"
        />
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex min-h-6 flex-wrap items-center gap-2">
          {insight?.marketPriceCents ? (
            <PriceRatingBadge
              priceCents={listing.price_cents}
              marketPriceCents={insight.marketPriceCents}
            />
          ) : null}
          {listing.published_at && (
            <span className="text-muted-foreground text-xs">{listedAgo(listing.published_at)}</span>
          )}
        </div>
        <h3 className="leading-snug font-semibold">
          {/* Stretched link: the whole card is clickable, the heart stays its own button. */}
          <Link
            href={`/listings/${listing.listing_id}`}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none group-focus-within:underline hover:underline"
          >
            {title}
          </Link>
        </h3>
        {listing.trim_level && (
          <p className="text-muted-foreground -mt-1 truncate text-sm">{listing.trim_level}</p>
        )}
        <div className="mt-1 flex items-baseline justify-between gap-2">
          <p className="font-display text-xl font-bold">{formatPrice(listing.price_cents)}</p>
          {!status && (
            <p className="text-muted-foreground text-xs">
              Est. {formatPrice(monthly)}
              <span aria-hidden>/mo</span>
              <span className="sr-only"> per month</span>
            </p>
          )}
        </div>
        <p className="text-muted-foreground text-sm">
          {formatMileage(listing.mileage)} · {listing.city}, {listing.region}
          {listing.distance_m !== null && ` · ${formatDistance(listing.distance_m)} away`}
        </p>
        <p className="text-muted-foreground mt-auto truncate border-t pt-3 text-xs">
          <span className="text-foreground font-medium">
            {listing.seller_type === 'dealer' ? 'Dealer' : 'Private seller'}
          </span>{' '}
          · {listing.seller_name}
        </p>
      </div>
    </article>
  );
}
