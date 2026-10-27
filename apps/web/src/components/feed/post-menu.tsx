'use client';

import { usePathname, useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { LinkIcon, MoreHorizontalIcon, Trash2Icon } from 'lucide-react';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { deletePost } from '@/lib/actions/posts';

export function PostMenu({
  postId,
  isOwn,
  onDeleted,
}: {
  postId: string;
  isOwn: boolean;
  onDeleted?: () => void;
}) {
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  const pathname = usePathname();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="text-muted-foreground hover:bg-accent hover:text-foreground focus-visible:ring-ring/50 relative z-10 -mt-2 -mr-2 grid size-9 place-items-center rounded-full outline-none focus-visible:ring-[3px]"
        aria-label="More"
        disabled={pending}
      >
        <MoreHorizontalIcon className="size-5" aria-hidden />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onSelect={async () => {
            try {
              await navigator.clipboard.writeText(`${window.location.origin}/p/${postId}`);
              toast.success('Link copied');
            } catch {
              toast.error('Couldn’t copy the link');
            }
          }}
        >
          <LinkIcon /> Copy link
        </DropdownMenuItem>
        {isOwn ? (
          <DropdownMenuItem
            className="text-destructive focus:text-destructive [&_svg]:text-destructive"
            onSelect={() => {
              if (!window.confirm('Delete this post? This can’t be undone.')) return;
              startTransition(async () => {
                const result = await deletePost({ postId });
                if (!result.ok) {
                  toast.error(result.error.message);
                  return;
                }
                toast.success('Post deleted');
                if (onDeleted) onDeleted();
                // On the post's own page there's nothing left to show.
                else if (pathname === `/p/${postId}`) router.replace('/');
                else router.refresh();
              });
            }}
          >
            <Trash2Icon /> Delete
          </DropdownMenuItem>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
