'use client';

import type { ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { isReelPlayer } from './nav';

/** Hides the header on phones while the reel player is open, so the video fills the screen. */
export function HideOnReelPlayer({ children }: { children: ReactNode }) {
  const hide = isReelPlayer(usePathname());
  return <div className={cn('contents', hide && 'max-md:hidden')}>{children}</div>;
}
