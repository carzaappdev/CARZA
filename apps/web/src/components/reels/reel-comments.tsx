'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { type ReactNode, useCallback, useState } from 'react';
import { Loader2Icon } from 'lucide-react';
import type { PostView } from '@carza/db';
import { Composer } from '@/components/feed/composer';
import { PostCard } from '@/components/feed/post-card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { loadReelComments } from '@/lib/actions/reels';
import type { ReelViewer } from './reel-item';

/** Comments on a reel, in a sheet over the video. Loaded when opened. */
export function ReelComments({
  reelId,
  viewer,
  onCountChange,
  children,
}: {
  reelId: string;
  viewer: ReelViewer | null;
  onCountChange: (count: number) => void;
  /** The button that opens the sheet. */
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [comments, setComments] = useState<PostView[] | null>(null);

  const load = useCallback(async () => {
    const result = await loadReelComments({ reelId });
    if (result.ok) {
      setComments(result.data);
      onCountChange(result.data.length);
    } else setComments([]);
  }, [reelId, onCountChange]);

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) void load();
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="h-[75dvh] gap-0 p-0 sm:h-[70dvh]">
        <DialogTitle className="border-b px-5 py-4 text-base">Comments</DialogTitle>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {comments === null ? (
            <div className="grid h-40 place-items-center">
              <Loader2Icon
                className="text-muted-foreground size-6 animate-spin"
                aria-label="Loading"
              />
            </div>
          ) : comments.length ? (
            comments.map((c) => (
              <PostCard
                key={c.id}
                post={c}
                viewerId={viewer?.id ?? null}
                onDeleted={() => void load()}
              />
            ))
          ) : (
            <p className="text-muted-foreground px-5 py-10 text-center text-[15px]">
              No comments yet. Start the conversation.
            </p>
          )}
        </div>
        <div className="border-t">
          {viewer ? (
            <Composer
              viewer={viewer}
              reelId={reelId}
              placeholder="Add a comment…"
              onPosted={() => void load()}
            />
          ) : (
            <div className="flex items-center gap-3 px-4 py-3">
              <p className="text-muted-foreground flex-1 text-sm">Sign in to comment.</p>
              <Button asChild size="sm" className="rounded-full">
                <Link href={`/sign-in?next=${encodeURIComponent(`/reels/${reelId}`)}` as Route}>
                  Sign in
                </Link>
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
