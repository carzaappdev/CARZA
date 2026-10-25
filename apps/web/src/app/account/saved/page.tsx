import type { Metadata } from 'next';
import Link from 'next/link';
import { HeartIcon } from 'lucide-react';
import { getListingInsights, getSavedListings } from '@carza/db';
import { EmptyState } from '@/components/feedback/empty-state';
import { PageHeader } from '@/components/layout/page-header';
import { ListingCard } from '@/components/listings/listing-card';
import { Button } from '@/components/ui/button';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Saved cars' };

export default async function SavedPage() {
  // The account layout already requires a signed-in user; RLS returns only their own saved rows.
  const supabase = await createClient();
  const listings = await getSavedListings(supabase);
  const insights = await getListingInsights(
    supabase,
    listings.slice(0, 48).map((l) => l.listing_id),
  );

  return (
    <>
      <PageHeader
        title="Saved cars"
        description={
          listings.length
            ? `${listings.length} ${listings.length === 1 ? 'car' : 'cars'} you’re keeping an eye on.`
            : 'Cars you’ve saved.'
        }
      />
      {listings.length > 0 ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {listings.map((listing) => (
            <li key={listing.listing_id} className="flex">
              <ListingCard
                listing={listing}
                insight={insights.get(listing.listing_id)}
                saved
                signedIn
              />
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState
          Icon={HeartIcon}
          title="Nothing saved yet"
          body="Tap the heart on any car to keep it here and compare later."
          action={
            <Button asChild>
              <Link href="/search">Browse cars</Link>
            </Button>
          }
        />
      )}
    </>
  );
}
