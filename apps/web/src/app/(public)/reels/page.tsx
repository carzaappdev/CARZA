import type { Metadata, Route } from 'next';
import { getReels } from '@carza/db';
import { ReelsFeed } from '@/components/reels/reels-feed';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: 'Reels' };

export default async function ReelsPage() {
  const user = await getUser();
  const initial = await getReels(
    await createClient(),
    { before: null, beforeId: null },
    user?.id ?? null,
  );
  return (
    <ReelsFeed
      key={initial.reels[0]?.id ?? 'empty'}
      initial={initial}
      viewerId={user?.id ?? null}
      createHref={
        (user ? '/reels/new' : `/sign-in?next=${encodeURIComponent('/reels/new')}`) as Route
      }
    />
  );
}
