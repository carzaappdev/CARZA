import Image from 'next/image';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { publicStorageUrl } from '@/lib/storage';
import { cn } from '@/lib/utils';

export function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?'
  );
}

/** A person's round photo, or their initials. Decorative: the name always appears next to it. */
export function UserAvatar({
  name,
  path,
  large = false,
  className,
}: {
  name: string;
  path: string | null;
  /** The 80px profile-header size. */
  large?: boolean;
  className?: string;
}) {
  return (
    <Avatar className={cn(large ? 'size-20' : 'size-9', className)}>
      <AvatarFallback className={cn('bg-muted text-foreground', large && 'text-2xl')}>
        {initials(name)}
      </AvatarFallback>
      {/* Uploads are up to 2048px; the optimizer serves a tiny copy instead. Initials show underneath while it loads. */}
      {path ? (
        <Image
          src={publicStorageUrl('avatars', path)}
          alt=""
          fill
          sizes={large ? '80px' : '48px'}
          className="object-cover"
        />
      ) : null}
    </Avatar>
  );
}
