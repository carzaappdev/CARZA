import type { Metadata } from 'next';
import { ReelUploader } from '@/components/reels/reel-uploader';
import { requireUser } from '@/lib/auth';

export const metadata: Metadata = { title: 'Post a reel' };

export default async function NewReelPage() {
  await requireUser('/reels/new');
  return (
    <div className="mx-auto flex w-full max-w-[640px] flex-1 flex-col gap-6 px-4 py-6 sm:border-x md:py-10">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-3xl font-bold tracking-tight">Post a reel</h1>
        <p className="text-muted-foreground">
          A short clip of your car: a cold start, a walkaround, a launch.
        </p>
      </div>
      <ReelUploader />
    </div>
  );
}
