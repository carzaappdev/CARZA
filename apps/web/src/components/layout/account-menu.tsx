'use client';

import type { Route } from 'next';
import Link from 'next/link';
import { LogOutIcon, SettingsIcon, UserIcon } from 'lucide-react';
import { signOut } from '@/app/auth/actions';
import { UserAvatar } from '@/components/feed/user-avatar';
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

export function AccountMenu({ viewer }: { viewer: Viewer }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Account menu" data-testid="account-link">
          <UserAvatar name={viewer.displayName} path={viewer.avatarPath} />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel>
          <span className="block truncate font-semibold">{viewer.displayName}</span>
          {viewer.username ? (
            <span className="text-muted-foreground block truncate text-xs">@{viewer.username}</span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuGroup>
          {viewer.username ? (
            <DropdownMenuItem asChild>
              <Link href={`/u/${viewer.username}` as Route}>
                <UserIcon /> Your profile
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem asChild>
            <Link href="/account/settings">
              <SettingsIcon /> Edit profile
            </Link>
          </DropdownMenuItem>
        </DropdownMenuGroup>
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
