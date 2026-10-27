import type { Metadata, Route } from 'next';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { z } from 'zod';
import { getReel, getReels } from '@carza/db';
import { ReelsFeed } from '@/components/reels/reels-feed';
import { getUser } from '@/lib/auth';
import { publicStorageUrl } from '@/lib/storage';
import { createClient } from '@/lib/supabase/server';

type Props = { params: Promise<{ id: string }> };

const loadReel = cache(async (id: string) => {
  if (!z.guid().safeParse(id).success) return null;
  const user = await getUser();
  return getReel(await createClient(), id, user?.id ?? null);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const reel = await loadReel((await params).id);
  if (!reel) return { title: 'Reel not found' };
  const title = `${reel.author.display_name} on Carza`;
  return {
    title,
    description: reel.caption || undefined,
    openGraph: { title, images: [publicStorageUrl('reels', reel.posterPath)] },
  };
}

/** A shared reel, followed by the older reels so people can keep swiping. */
export default async function ReelPage({ params }: Props) {
  const reel = await loadReel((await params).id);
  if (!reel) notFound();
  const user = await getUser();
  const rest = await getReels(
    await createClient(),
    { before: reel.createdAt, beforeId: reel.id },
    user?.id ?? null,
  );
  return (
    <ReelsFeed
      key={reel.id}
      initial={{ reels: [reel, ...rest.reels], next: rest.next }}
      viewerId={user?.id ?? null}
      createHref={
        (user ? '/reels/new' : `/sign-in?next=${encodeURIComponent('/reels/new')}`) as Route
      }
    />
  );
}
