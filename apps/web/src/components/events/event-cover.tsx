import Image from 'next/image';
import { publicStorageUrl } from '@/lib/storage';
import { cn } from '@/lib/utils';

/** An event's cover photo at 16:9. Events without one simply skip it. */
export function EventCover({
  path,
  sizes,
  priority = false,
  className,
}: {
  path: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  return (
    <div className={cn('bg-muted relative aspect-[16/9] overflow-hidden', className)}>
      <Image
        src={publicStorageUrl('post-photos', path)}
        alt=""
        fill
        sizes={sizes}
        priority={priority}
        className="object-cover"
      />
    </div>
  );
}
