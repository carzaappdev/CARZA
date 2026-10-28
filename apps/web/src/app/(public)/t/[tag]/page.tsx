import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { HashIcon } from 'lucide-react';
import { getTagPosts } from '@carza/db';
import { normalizeTag } from '@carza/shared';
import { EmptyState } from '@/components/feedback/empty-state';
import { PostCard } from '@/components/feed/post-card';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/viewer';

type Props = { params: Promise<{ tag: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const tag = normalizeTag(decodeURIComponent((await params).tag));
  return tag ? { title: `#${tag}`, description: `Posts tagged #${tag} on Carza.` } : {};
}

export default async function TagPage({ params }: Props) {
  const tag = normalizeTag(decodeURIComponent((await params).tag));
  if (!tag) notFound();
  const viewer = await getViewer();
  const posts = await getTagPosts(await createClient(), tag, viewer?.id ?? null);

  return (
    <div className="mx-auto w-full max-w-[640px] flex-1 sm:border-x">
      <header className="flex items-center gap-3 border-b px-4 py-4">
        <span className="bg-muted grid size-11 place-items-center rounded-full">
          <HashIcon className="size-5" aria-hidden />
        </span>
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight">#{tag}</h1>
          <p className="text-muted-foreground text-sm">
            {posts.length === 50
              ? '50+ posts'
              : `${posts.length} ${posts.length === 1 ? 'post' : 'posts'}`}
          </p>
        </div>
      </header>
      {posts.length ? (
        posts.map((post) => (
          <PostCard key={post.id} post={post} viewerId={viewer?.id ?? null} showReplyContext />
        ))
      ) : (
        <div className="p-4">
          <EmptyState
            Icon={HashIcon}
            title="No posts yet"
            body={`Be the first: add #${tag} to a post.`}
          />
        </div>
      )}
    </div>
  );
}
