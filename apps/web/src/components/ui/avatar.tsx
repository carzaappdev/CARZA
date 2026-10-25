import type { ComponentProps } from 'react';
import { Avatar as AvatarPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

export function Avatar({ className, ...props }: ComponentProps<typeof AvatarPrimitive.Root>) {
  return (
    <AvatarPrimitive.Root
      className={cn('relative flex size-8 shrink-0 overflow-hidden rounded-full', className)}
      {...props}
    />
  );
}

export function AvatarImage({ className, ...props }: ComponentProps<typeof AvatarPrimitive.Image>) {
  return <AvatarPrimitive.Image className={cn('aspect-square size-full', className)} {...props} />;
}

export function AvatarFallback({
  className,
  ...props
}: ComponentProps<typeof AvatarPrimitive.Fallback>) {
  return (
    <AvatarPrimitive.Fallback
      className={cn(
        'bg-muted flex size-full items-center justify-center rounded-full text-xs font-semibold',
        className,
      )}
      {...props}
    />
  );
}
