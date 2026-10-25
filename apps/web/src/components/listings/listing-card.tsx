import Link from 'next/link';
import type { ListingCard as ListingCardRow } from '@carza/db';
import {
  CONDITION_LABELS,
  formatDistance,
  formatMileage,
  formatPrice,
  vehicleTitle,
} from '@carza/shared';
import { ListingPhoto } from './listing-photo';

export function ListingCard({ listing }: { listing: ListingCardRow }) {
  const title = vehicleTitle({
    year: listing.year,
    make: listing.make_name,
    model: listing.model_name,
  });
  return (
    <Link
      href={`/listings/${listing.listing_id}`}
      className="group bg-card text-card-foreground border-border w-full focus-visible:ring-ring flex flex-col overflow-hidden rounded-xl border transition-shadow hover:shadow-md focus-visible:ring-2 focus-visible:outline-none"
    >
      <div className="relative aspect-[4/3]">
        <ListingPhoto
          path={listing.photo_path}
          alt={title}
          sizes="(min-width: 1280px) 25vw, (min-width: 640px) 50vw, 100vw"
        />
        {listing.condition !== 'used' && (
          <span className="bg-background/90 absolute top-2 left-2 rounded-full px-2.5 py-1 text-xs font-semibold">
            {CONDITION_LABELS[listing.condition]}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-4">
        <h3 className="leading-snug font-semibold group-hover:underline">{title}</h3>
        {listing.trim_level && (
          <p className="text-muted-foreground truncate text-sm">{listing.trim_level}</p>
        )}
        <p className="font-display mt-1 text-xl font-bold">{formatPrice(listing.price_cents)}</p>
        <p className="text-muted-foreground text-sm">
          {formatMileage(listing.mileage)} · {listing.city}, {listing.region}
          {listing.distance_m !== null && ` · ${formatDistance(listing.distance_m)}`}
        </p>
        <p className="text-muted-foreground mt-auto truncate pt-2 text-xs">
          {listing.seller_type === 'dealer' ? 'Dealer' : 'Private seller'} · {listing.seller_name}
        </p>
      </div>
    </Link>
  );
}
