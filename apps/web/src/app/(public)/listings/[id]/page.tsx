import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { z } from 'zod';
import { getListing, type ListingDetail } from '@carza/db';
import {
  BODY_STYLE_LABELS,
  CONDITION_LABELS,
  DRIVETRAIN_LABELS,
  FUEL_TYPE_LABELS,
  TRANSMISSION_LABELS,
  formatMileage,
  formatPrice,
  vehicleTitle,
} from '@carza/shared';
import { ListingPhoto, listingPhotoUrl } from '@/components/listings/listing-photo';
import { createClient } from '@/lib/supabase/server';

// Shared by generateMetadata and the page, so the listing is fetched once per request.
const loadListing = cache(async (id: string) => {
  if (!z.guid().safeParse(id).success) return null;
  return getListing(await createClient(), id);
});

const titleOf = (l: ListingDetail) =>
  vehicleTitle({
    year: l.vehicle.year,
    make: l.vehicle.model.make.name,
    model: l.vehicle.model.name,
    trim: l.vehicle.trim_level,
  });

export async function generateMetadata({ params }: PageProps<'/listings/[id]'>): Promise<Metadata> {
  const listing = await loadListing((await params).id);
  if (!listing) return { title: 'Listing not found' };
  const title = `${titleOf(listing)} · ${formatPrice(listing.price_cents)} · ${listing.city}, ${listing.region}`;
  const photo = listing.photos[0];
  return {
    title,
    description: listing.description?.slice(0, 160) ?? undefined,
    // Drafts, sold and removed listings stay out of search engines.
    robots: listing.status === 'active' ? undefined : { index: false },
    openGraph: { title, images: photo ? [listingPhotoUrl(photo.storage_path)] : undefined },
  };
}

const STATUS_NOTICE: Partial<Record<ListingDetail['status'], string>> = {
  draft: 'This is a draft. It isn’t public until it’s published.',
  pending: 'Sale pending. The seller has an offer on this car.',
  sold: 'This car has been sold.',
  removed: 'This listing was removed. It isn’t public anymore.',
};

export default async function ListingPage({ params }: PageProps<'/listings/[id]'>) {
  const listing = await loadListing((await params).id);
  if (!listing) notFound();

  const { vehicle } = listing;
  const title = titleOf(listing);
  const notice = STATUS_NOTICE[listing.status];
  const specs: [string, string | null][] = [
    ['Mileage', formatMileage(vehicle.mileage)],
    ['Condition', CONDITION_LABELS[listing.condition]],
    ['Body style', vehicle.body_style && BODY_STYLE_LABELS[vehicle.body_style]],
    ['Drivetrain', vehicle.drivetrain && DRIVETRAIN_LABELS[vehicle.drivetrain]],
    ['Transmission', vehicle.transmission && TRANSMISSION_LABELS[vehicle.transmission]],
    ['Fuel', vehicle.fuel_type && FUEL_TYPE_LABELS[vehicle.fuel_type]],
    ['Exterior color', vehicle.exterior_color],
    ['Interior color', vehicle.interior_color],
    ['VIN', vehicle.vin],
  ];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      <Link href="/search" className="text-muted-foreground text-sm hover:underline">
        ← Back to search
      </Link>

      {notice && (
        <p role="status" className="bg-muted mt-4 rounded-md px-4 py-3 text-sm font-medium">
          {notice}
        </p>
      )}

      {/* Phones: photos, then price and seller, then details. Desktop: summary in a sticky right column. */}
      <div className="mt-4 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div className="min-w-0 lg:col-start-1">
          <Gallery photos={listing.photos} title={title} />
        </div>

        <aside className="flex flex-col gap-4 lg:sticky lg:top-6 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:self-start">
          <div className="border-border rounded-xl border p-5">
            <h1 className="font-display text-2xl leading-tight font-bold">{title}</h1>
            <p className="font-display mt-3 text-3xl font-extrabold">
              {formatPrice(listing.price_cents)}
            </p>
            <p className="text-muted-foreground mt-2 text-sm">
              {formatMileage(vehicle.mileage)} · {listing.city}, {listing.region}
            </p>
          </div>
          <SellerCard listing={listing} />
        </aside>

        <div className="flex min-w-0 flex-col gap-8 lg:col-start-1">
          <section aria-labelledby="specs-heading">
            <h2 id="specs-heading" className="text-lg font-semibold">
              Details
            </h2>
            <dl className="mt-3 grid gap-x-6 sm:grid-cols-2">
              {specs
                .filter((s): s is [string, string] => Boolean(s[1]))
                .map(([label, value]) => (
                  <div
                    key={label}
                    className="border-border flex justify-between gap-4 border-b py-3 text-sm"
                  >
                    <dt className="text-muted-foreground">{label}</dt>
                    <dd className="text-right font-medium break-all">{value}</dd>
                  </div>
                ))}
            </dl>
          </section>

          {listing.description && (
            <section aria-labelledby="description-heading">
              <h2 id="description-heading" className="text-lg font-semibold">
                From the seller
              </h2>
              <p className="mt-3 text-sm leading-relaxed whitespace-pre-line">
                {listing.description}
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function Gallery({ photos, title }: { photos: ListingDetail['photos']; title: string }) {
  if (photos.length === 0) {
    return (
      <div className="relative aspect-[16/10] overflow-hidden rounded-xl">
        <ListingPhoto path={null} alt="" sizes="100vw" />
      </div>
    );
  }
  // CSS scroll-snap carousel: swipe on phones, scroll on desktop. No JavaScript needed.
  return (
    <div
      className="flex snap-x snap-mandatory gap-2 overflow-x-auto rounded-xl"
      role="region"
      aria-label={`${photos.length} photos`}
      tabIndex={0}
    >
      {photos.map((p, i) => (
        <div
          key={p.storage_path}
          className="relative aspect-[16/10] w-full shrink-0 snap-center overflow-hidden rounded-xl"
        >
          <ListingPhoto
            path={p.storage_path}
            alt={`${title}, photo ${i + 1} of ${photos.length}`}
            sizes="(min-width: 1024px) 66vw, 100vw"
            priority={i === 0}
          />
        </div>
      ))}
    </div>
  );
}

function SellerCard({ listing }: { listing: ListingDetail }) {
  const { dealership, seller } = listing;
  return (
    <div className="border-border rounded-xl border p-5">
      <p className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
        {dealership ? 'Dealer' : 'Private seller'}
      </p>
      <p className="mt-1 text-lg font-semibold">{dealership?.name ?? seller?.display_name}</p>
      {dealership && (
        <div className="mt-2 flex flex-col gap-1 text-sm">
          <p className="text-muted-foreground">
            {dealership.city}, {dealership.region}
          </p>
          {dealership.phone && (
            <a href={`tel:${dealership.phone}`} className="font-medium underline">
              {dealership.phone}
            </a>
          )}
        </div>
      )}
      {seller?.city && (
        <p className="text-muted-foreground mt-2 text-sm">
          {seller.city}
          {seller.region ? `, ${seller.region}` : ''}
        </p>
      )}
    </div>
  );
}
