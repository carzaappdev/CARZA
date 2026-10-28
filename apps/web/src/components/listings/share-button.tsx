'use client';

import { Share2Icon } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';

/** Native share sheet on phones; copies the link elsewhere. */
export function ShareButton({
  title,
  className,
  path,
  label = 'Share',
}: {
  title: string;
  className?: string;
  /** Share this path on the site instead of the current page. */
  path?: string;
  label?: string;
}) {
  async function share() {
    const url = path ? new URL(path, window.location.origin).href : window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title, url });
      } catch {
        // The buyer closed the share sheet.
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Link copied');
    } catch {
      toast.error('Couldn’t copy the link');
    }
  }
  return (
    <Button type="button" variant="outline" className={className} onClick={share}>
      <Share2Icon />
      {label}
    </Button>
  );
}
