'use client';

import Link from 'next/link';
import { LogOutIcon, StoreIcon } from 'lucide-react';
import { signOut } from '@/app/auth/actions';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import type { Viewer } from '@/lib/viewer';
import { ACCOUNT_NAV } from './nav';

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join('') || '?'
  );
}

export function AccountMenu({ viewer }: { viewer: Viewer }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Account menu" data-testid="account-link">
          <Avatar className="size-9">
            <AvatarFallback>{initials(viewer.displayName)}</AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <span className="block truncate font-semibold">{viewer.displayName}</span>
          <span className="text-muted-foreground block truncate text-xs">@{viewer.username}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {ACCOUNT_NAV.map(({ href, label, Icon }) => (
            <DropdownMenuItem key={href} asChild>
              <Link href={href}>
                <Icon /> {label}
              </Link>
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dealer">
            <StoreIcon /> Dealer dashboard
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOut}>
          <DropdownMenuItem asChild>
            <button type="submit" className="w-full">
              <LogOutIcon /> Sign out
            </button>
          </DropdownMenuItem>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
