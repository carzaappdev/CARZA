'use client';

import { useRouter } from 'next/navigation';
import { ArrowLeftIcon } from 'lucide-react';

/** A sticky title row with a back arrow. Goes back in history, or to the feed when opened from a link. */
export function BackHeader({ title }: { title: string }) {
  const router = useRouter();
  return (
    <div className="bg-background/95 sticky top-14 z-30 flex h-12 items-center gap-2 border-b px-2 backdrop-blur md:top-16">
      <button
        type="button"
        aria-label="Back"
        onClick={() => (window.history.length > 1 ? router.back() : router.push('/'))}
        className="hover:bg-accent focus-visible:ring-ring/50 grid size-10 place-items-center rounded-full outline-none focus-visible:ring-[3px]"
      >
        <ArrowLeftIcon className="size-5" aria-hidden />
      </button>
      <h1 className="text-[15px] font-semibold">{title}</h1>
    </div>
  );
}
