import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { cache } from 'react';
import { MessageCircleIcon } from 'lucide-react';
import { z } from 'zod';
import { getPost, getReplies } from '@carza/db';
import { Composer } from '@/components/feed/composer';
import { PostCard } from '@/components/feed/post-card';
import { Button } from '@/components/ui/button';
import { getUser } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { getViewer } from '@/lib/viewer';

type Props = { params: Promise<{ id: string }> };

const loadPost = cache(async (id: string) => {
  if (!z.guid().safeParse(id).success) return null;
  const user = await getUser();
  return getPost(await createClient(), id, user?.id ?? null);
});

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const post = await loadPost((await params).id);
  if (!post) return { title: 'Post not found' };
  const text = post.body || 'Photo';
  return {
    title: `${post.author.display_name}: “${text.length > 60 ? `${text.slice(0, 57)}…` : text}”`,
    description: post.body.slice(0, 200) || undefined,
  };
}

export default async function PostPage({ params }: Props) {
  const { id } = await params;
  const post = await loadPost(id);
  if (!post) notFound();

  const supabase = await createClient();
  const viewer = await getViewer();
  const viewerId = viewer?.id ?? null;
  const [parent, replies] = await Promise.all([
    post.replyToId ? getPost(supabase, post.replyToId, viewerId) : null,
    getReplies(supabase, post.id, viewerId),
  ]);

  return (
    <div className="mx-auto w-full max-w-[640px] flex-1 sm:border-x">
      <h1 className="sr-only">Post by {post.author.display_name}</h1>
      {parent ? <PostCard post={parent} viewerId={viewerId} connector /> : null}
      <div className="border-b">
        <PostCard post={post} viewerId={viewerId} size="lg" />
      </div>

      <div id="reply" className="scroll-mt-32">
        {viewer ? (
          <Composer
            viewer={viewer}
            replyToId={post.id}
            placeholder={`Reply to ${post.author.display_name}…`}
          />
        ) : (
          <div className="flex items-center gap-3 border-b px-4 py-4">
            <p className="text-muted-foreground flex-1 text-[15px]">
              Sign in to join the conversation.
            </p>
            <Button asChild size="sm" className="rounded-full">
              <Link href={`/sign-in?next=${encodeURIComponent(`/p/${post.id}`)}`}>Sign in</Link>
            </Button>
          </div>
        )}
      </div>

      {replies.length > 0 ? (
        <section aria-label="Replies">
          <ul>
            {replies.map((reply) => (
              <li key={reply.id}>
                <PostCard post={reply} viewerId={viewerId} />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="text-muted-foreground flex flex-col items-center gap-2 px-6 py-12 text-center text-sm">
          <MessageCircleIcon className="size-6" aria-hidden />
          No replies yet. Start the conversation.
        </div>
      )}
    </div>
  );
}
