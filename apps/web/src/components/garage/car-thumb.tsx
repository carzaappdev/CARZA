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
        // eslint-disable-next-line @next/next/no-img-element -- small thumbnail from public storage
        <img
          src={publicStorageUrl('post-photos', path)}
          alt=""
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <CarFrontIcon className="text-muted-foreground size-1/2" aria-hidden />
      )}
    </span>
  );
}
