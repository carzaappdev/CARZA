'use client';

import type { Route } from 'next';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { ClapperboardIcon, Loader2Icon, RefreshCwIcon } from 'lucide-react';
import { toast } from 'sonner';
import { LIMITS } from '@carza/shared';
import { Button } from '@/components/ui/button';
import { createReel } from '@/lib/actions/reels';
import { uploadFile } from '@/lib/upload';
import { prepareVideo, type PreparedVideo } from '@/lib/video';

type Stage = 'idle' | 'reading' | 'ready' | 'uploading';

/** Pick a clip, preview it, add a caption, post. Checks length, size and format before uploading. */
export function ReelUploader() {
  const router = useRouter();
  const input = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>('idle');
  const [video, setVideo] = useState<PreparedVideo | null>(null);
  const [caption, setCaption] = useState('');

  useEffect(() => () => (video ? URL.revokeObjectURL(video.previewUrl) : undefined), [video]);

  async function pick(file: File | undefined) {
    if (!file) return;
    setStage('reading');
    try {
      setVideo(await prepareVideo(file));
      setStage('ready');
    } catch (e) {
      setStage(video ? 'ready' : 'idle');
      toast.error(
        e instanceof Error && e.message.length < 140 ? e.message : 'That video can’t be used.',
      );
    }
  }

  async function post() {
    if (!video) return;
    setStage('uploading');
    const [poster, clip] = await Promise.all([
      uploadFile('reels', video.poster, 'image/webp'),
      uploadFile('reels', video.file, video.contentType),
    ]);
    if ('error' in poster || 'error' in clip) {
      toast.error('error' in clip ? clip.error : 'error' in poster ? poster.error : '');
      setStage('ready');
      return;
    }
    const result = await createReel({
      videoPath: clip.path,
      posterPath: poster.path,
      width: video.width,
      height: video.height,
      durationSeconds: video.durationSeconds,
      caption,
    });
    if (!result.ok) {
      toast.error(result.error.message);
      setStage('ready');
      return;
    }
    toast.success('Your reel is live');
    router.push(`/reels/${result.data.id}` as Route);
  }

  const busy = stage === 'reading' || stage === 'uploading';

  return (
    <div className="flex flex-col gap-5">
      <input
        ref={input}
        type="file"
        accept={[...LIMITS.videoMimeTypes, '.mp4', '.mov', '.webm'].join(',')}
        hidden
        onChange={(e) => {
          void pick(e.target.files?.[0]);
          e.target.value = '';
        }}
      />

      {video ? (
        <div className="relative mx-auto aspect-[9/16] w-[min(100%,20rem,33.75dvh)] overflow-hidden rounded-2xl bg-black">
          <video
            src={video.previewUrl}
            className="size-full object-contain"
            autoPlay
            muted
            loop
            playsInline
            controls={false}
          />
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={busy}
            className="focus-visible:ring-ring/50 absolute top-2 right-2 flex h-9 items-center gap-1.5 rounded-full bg-black/70 px-3 text-sm font-medium text-white outline-none focus-visible:ring-[3px]"
          >
            <RefreshCwIcon className="size-4" aria-hidden /> Change
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => input.current?.click()}
          disabled={busy}
          className="bg-muted/60 hover:bg-muted focus-visible:ring-ring/50 mx-auto flex aspect-[9/16] w-[min(100%,20rem,33.75dvh)] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed px-6 text-center outline-none focus-visible:ring-[3px]"
        >
          {stage === 'reading' ? (
            <Loader2Icon
              className="text-muted-foreground size-8 animate-spin"
              aria-label="Reading video"
            />
          ) : (
            <ClapperboardIcon className="text-muted-foreground size-8" aria-hidden />
          )}
          <span className="font-semibold">Choose a video</span>
          <span className="text-muted-foreground text-sm">
            Vertical works best. Up to {LIMITS.reelMaxSeconds} seconds and 50 MB.
          </span>
        </button>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="caption" className="text-sm font-medium">
          Caption
        </label>
        <textarea
          id="caption"
          rows={3}
          maxLength={LIMITS.reelCaptionMaxLength}
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          placeholder="What are we looking at?"
          className="bg-background focus-visible:ring-ring/50 w-full rounded-lg border px-3 py-2.5 text-[15px] leading-[1.4] outline-none focus-visible:ring-[3px]"
        />
      </div>

      <Button
        type="button"
        size="lg"
        className="h-12 rounded-xl text-base"
        disabled={!video || busy}
        onClick={post}
      >
        {stage === 'uploading' ? (
          <>
            <Loader2Icon className="animate-spin" aria-hidden /> Uploading…
          </>
        ) : (
          'Post reel'
        )}
      </Button>
    </div>
  );
}
