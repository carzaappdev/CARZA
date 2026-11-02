import Image from 'next/image';
import { CarFrontIcon } from 'lucide-react';
import { publicStorageUrl } from '@/lib/storage';
import { cn } from '@/lib/utils';

/** A car's photo, or a placeholder. */
export function CarThumb({ path, className }: { path: string | null; className?: string }) {
  return (
    <span
      className={cn(
        'bg-muted relative grid shrink-0 place-items-center overflow-hidden rounded-lg',
        className,
      )}
    >
      {path ? (
        <Image
          src={publicStorageUrl('post-photos', path)}
          alt=""
          fill
          sizes="220px"
          className="object-cover"
        />
      ) : (
        <CarFrontIcon className="text-muted-foreground size-1/2" aria-hidden />
      )}
    </span>
  );
}
