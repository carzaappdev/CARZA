'use client';

import { useEffect, useRef, useState } from 'react';
import { Loader2Icon } from 'lucide-react';
import type { FeedPage, PostView } from '@carza/db';
import { loadFeedPage } from '@/lib/actions/posts';
import { PostCard } from './post-card';

/** Posts with infinite scroll. Re-mount (via `key`) when the first page changes. */
export function FeedList({
  initial,
  viewerId,
  empty,
}: {
  initial: FeedPage;
  viewerId: string | null;
  empty: React.ReactNode;
}) {
  const [posts, setPosts] = useState<PostView[]>(initial.posts);
  const [next, setNext] = useState(initial.next);
  const [failed, setFailed] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const loading = useRef(false);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !next || failed) return;
    const observer = new IntersectionObserver(
      async ([entry]) => {
        if (!entry?.isIntersecting || loading.current) return;
        loading.current = true;
        const result = await loadFeedPage(next);
        loading.current = false;
        if (!result.ok) {
          setFailed(true);
          return;
        }
        // A post can shift pages if new ones arrive; never show it twice.
        setPosts((all) => {
          const seen = new Set(all.map((p) => p.id));
          return [...all, ...result.data.posts.filter((p) => !seen.has(p.id))];
        });
        setNext(result.data.next);
      },
      { rootMargin: '800px 0px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [next, failed]);

  if (posts.length === 0) return <div className="px-4 py-8">{empty}</div>;

  return (
    <>
      <ul>
        {posts.map((post) => (
          <li key={post.id}>
            <PostCard
              post={post}
              viewerId={viewerId}
              onDeleted={() => setPosts((all) => all.filter((p) => p.id !== post.id))}
            />
          </li>
        ))}
      </ul>
      {next ? (
        <div ref={sentinel} className="flex justify-center py-8">
          {failed ? (
            <button
              type="button"
              className="text-sm font-medium underline-offset-4 hover:underline"
              onClick={() => setFailed(false)}
            >
              Couldn’t load more. Try again
            </button>
          ) : (
            <Loader2Icon
              className="text-muted-foreground size-5 animate-spin"
              aria-label="Loading more posts"
            />
          )}
        </div>
      ) : (
        <p className="text-muted-foreground py-10 text-center text-sm">You’re all caught up.</p>
      )}
    </>
  );
}
