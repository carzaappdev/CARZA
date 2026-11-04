'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowUpIcon, Loader2Icon } from 'lucide-react';
import { toast } from 'sonner';
import type { FeedPage, PostView } from '@carza/db';
import { FEED_POLL_MS, newerPosts, type FeedCursor } from '@carza/shared';
import { loadFeedPage } from '@/lib/actions/posts';
import { Composer } from './composer';
import { PostCard } from './post-card';

/**
 * Posts with infinite scroll, under the composer when signed in. A new post goes straight to the top
 * (a ranked feed wouldn't put a fresh post there). While the tab is open it checks for new posts every
 * minute and offers a "New posts" pill instead of moving the list under the reader's thumb.
 * Re-mount (via `key`) when the first page changes.
 */
export function FeedList({
  feed,
  initial,
  viewer,
  empty,
}: {
  feed: FeedCursor['feed'];
  initial: FeedPage;
  viewer: { id: string; displayName: string; avatarPath: string | null } | null;
  empty: React.ReactNode;
}) {
  const viewerId = viewer?.id ?? null;
  const [posts, setPosts] = useState<PostView[]>(initial.posts);
  const [next, setNext] = useState(initial.next);
  const [failed, setFailed] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);
  const loading = useRef(false);
  const [newCount, setNewCount] = useState(0);
  const latest = useRef<FeedPage | null>(null);
  const shown = useRef(posts);

  useEffect(() => {
    shown.current = posts;
  }, [posts]);

  useEffect(() => {
    let stopped = false;
    async function check() {
      if (document.visibilityState !== 'visible') return;
      const result = await loadFeedPage({ feed, before: null, beforeId: null });
      if (stopped || !result.ok) return;
      const newer = newerPosts(shown.current, result.data.posts, viewerId);
      if (newer.length === 0) return;
      // New posts go first even when ranking would bury them, like a refresh on Threads.
      const ids = new Set(newer.map((p) => p.id));
      latest.current = {
        ...result.data,
        posts: [...newer, ...result.data.posts.filter((p) => !ids.has(p.id))],
      };
      setNewCount(newer.length);
    }
    const timer = setInterval(check, FEED_POLL_MS);
    const onVisible = () => void check();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [feed, viewerId]);

  function showNewPosts() {
    const page = latest.current;
    if (!page) return;
    setPosts(page.posts);
    setNext(page.next);
    setFailed(false);
    setNewCount(0);
    latest.current = null;
    const smooth = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    window.scrollTo({ top: 0, behavior: smooth ? 'smooth' : 'auto' });
  }

  const newPostsPill = (
    <div className="sticky top-[7.25rem] z-20 flex h-0 justify-center md:top-[7.75rem]">
      <p aria-live="polite" className="sr-only">
        {newCount > 0 ? `${newCount} new ${newCount === 1 ? 'post' : 'posts'}` : ''}
      </p>
      {newCount > 0 ? (
        <button
          type="button"
          onClick={showNewPosts}
          className="bg-primary text-primary-foreground focus-visible:ring-ring/50 animate-in fade-in slide-in-from-top-2 inline-flex h-10 items-center gap-1.5 rounded-full px-4 text-sm font-semibold shadow-lg outline-none focus-visible:ring-[3px] motion-reduce:animate-none"
        >
          <ArrowUpIcon className="size-4" aria-hidden />
          New posts
        </button>
      ) : null}
    </div>
  );

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

  const composer = viewer ? (
    <Composer
      viewer={viewer}
      onPosted={(post) => {
        setPosts((all) => [post, ...all.filter((p) => p.id !== post.id)]);
        toast.success('Posted');
      }}
    />
  ) : null;

  if (posts.length === 0)
    return (
      <>
        {newPostsPill}
        {composer}
        <div className="px-4 py-8">{empty}</div>
      </>
    );

  return (
    <>
      {newPostsPill}
      {composer}
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
