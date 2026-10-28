'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useId, useRef, useState, useTransition } from 'react';
import { ImageIcon, Loader2Icon, XIcon } from 'lucide-react';
import { toast } from 'sonner';
import { LIMITS, type PostPhoto } from '@carza/shared';
import { Button } from '@/components/ui/button';
import { createPost } from '@/lib/actions/posts';
import { prepareImage } from '@/lib/images';
import { uploadImage } from '@/lib/upload';
import { cn } from '@/lib/utils';
import { UserAvatar } from './user-avatar';

type Draft = { key: string; previewUrl: string; photo: PostPhoto | null };

/** Write a post or a reply. Photos upload as soon as they're picked, so posting is instant. */
export function Composer({
  viewer,
  replyToId = null,
  eventId = null,
  reelId = null,
  onPosted,
  placeholder = 'What’s new in your garage?',
  autoFocus = false,
}: {
  viewer: { displayName: string; avatarPath: string | null };
  replyToId?: string | null;
  /** Shares the post to this event's page too. */
  eventId?: string | null;
  /** Makes the post a comment on this reel. */
  reelId?: string | null;
  /** Called after posting, instead of refreshing the page. */
  onPosted?: () => void;
  placeholder?: string;
  autoFocus?: boolean;
}) {
  const router = useRouter();
  const id = useId();
  const textarea = useRef<HTMLTextAreaElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState('');
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [pending, startTransition] = useTransition();

  const uploading = drafts.some((d) => d.photo === null);
  const remaining = LIMITS.postMaxLength - body.length;
  const canPost =
    !pending && !uploading && remaining >= 0 && (body.trim() !== '' || drafts.length > 0);

  // Grow with the text instead of scrolling inside a tiny box.
  useEffect(() => {
    const el = textarea.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, [body]);

  async function addFiles(files: FileList | null) {
    const picked = Array.from(files ?? []).slice(0, LIMITS.postPhotosMax - drafts.length);
    if (files && files.length > picked.length)
      toast.message(`Up to ${LIMITS.postPhotosMax} photos per post.`);
    await Promise.all(
      picked.map(async (file) => {
        const key = crypto.randomUUID();
        try {
          const image = await prepareImage(file);
          setDrafts((d) => [...d, { key, previewUrl: image.previewUrl, photo: null }]);
          const result = await uploadImage('post-photos', image.blob);
          if ('error' in result) throw new Error(result.error);
          setDrafts((d) =>
            d.map((x) =>
              x.key === key
                ? { ...x, photo: { path: result.path, width: image.width, height: image.height } }
                : x,
            ),
          );
        } catch (e) {
          setDrafts((d) => d.filter((x) => x.key !== key));
          toast.error(
            e instanceof Error && e.message.length < 120
              ? e.message
              : 'That photo couldn’t be added.',
          );
        }
      }),
    );
  }

  function submit() {
    if (!canPost) return;
    startTransition(async () => {
      const photos = drafts.flatMap((d) => (d.photo ? [d.photo] : []));
      const result = await createPost({ body, photos, replyToId, eventId, reelId });
      if (!result.ok) {
        toast.error(result.error.message);
        return;
      }
      drafts.forEach((d) => URL.revokeObjectURL(d.previewUrl));
      setBody('');
      setDrafts([]);
      if (onPosted) return onPosted();
      toast.success(replyToId ? 'Reply posted' : 'Posted');
      router.refresh();
    });
  }

  return (
    <form
      className="flex gap-3 border-b px-4 py-4"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <UserAvatar name={viewer.displayName} path={viewer.avatarPath} />
      <div className="min-w-0 flex-1">
        <label htmlFor={`${id}-body`} className="sr-only">
          {replyToId ? 'Your reply' : 'New post'}
        </label>
        <textarea
          id={`${id}-body`}
          ref={textarea}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
          }}
          placeholder={placeholder}
          rows={1}
          autoFocus={autoFocus}
          maxLength={LIMITS.postMaxLength + 50}
          className="placeholder:text-muted-foreground block max-h-[50vh] min-h-9 w-full resize-none bg-transparent py-1.5 text-[15px] leading-[1.4] outline-none"
        />
        {drafts.length > 0 ? (
          <ul className="-mr-4 mt-2 flex gap-2 overflow-x-auto pr-4 pb-1">
            {drafts.map((d) => (
              <li key={d.key} className="relative shrink-0">
                {/* A local blob preview: next/image can't optimize object URLs. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={d.previewUrl}
                  alt=""
                  className="bg-muted h-40 w-auto rounded-xl border object-cover"
                />
                {d.photo === null ? (
                  <span className="absolute inset-0 grid place-items-center rounded-xl bg-black/30">
                    <Loader2Icon
                      className="size-6 animate-spin text-white"
                      aria-label="Uploading"
                    />
                  </span>
                ) : null}
                <button
                  type="button"
                  aria-label="Remove photo"
                  onClick={() => {
                    URL.revokeObjectURL(d.previewUrl);
                    setDrafts((all) => all.filter((x) => x.key !== d.key));
                  }}
                  className="focus-visible:ring-ring/50 absolute top-1.5 right-1.5 grid size-7 place-items-center rounded-full bg-black/70 text-white outline-none focus-visible:ring-[3px]"
                >
                  <XIcon className="size-4" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        ) : null}
        <div className="mt-2 flex items-center gap-2">
          <input
            ref={fileInput}
            type="file"
            accept={LIMITS.imageMimeTypes.join(',')}
            multiple
            hidden
            onChange={(e) => {
              void addFiles(e.target.files);
              e.target.value = '';
            }}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="text-muted-foreground -ml-2.5 rounded-full"
            aria-label="Add photos"
            disabled={drafts.length >= LIMITS.postPhotosMax || pending}
            onClick={() => fileInput.current?.click()}
          >
            <ImageIcon className="size-5" />
          </Button>
          <span
            aria-live="polite"
            className={cn(
              'ml-auto text-sm tabular-nums',
              remaining < 0 ? 'text-destructive font-medium' : 'text-muted-foreground',
            )}
          >
            {remaining <= 50 ? remaining : null}
          </span>
          <Button type="submit" size="sm" className="rounded-full px-4" disabled={!canPost}>
            {pending ? <Loader2Icon className="animate-spin" aria-hidden /> : null}
            {replyToId ? 'Reply' : 'Post'}
          </Button>
        </div>
      </div>
    </form>
  );
}
