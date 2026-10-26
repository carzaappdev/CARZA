'use client';

import Link from 'next/link';
import { CheckIcon, ChevronsUpDownIcon, PlusIcon } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export type DealershipOption = { id: string; name: string };

/** Switches between the dealerships this user belongs to (dealer groups). */
export function DealershipSwitcher({
  current,
  options,
}: {
  current: DealershipOption;
  options: DealershipOption[];
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="hover:bg-accent focus-visible:ring-ring/50 flex min-h-11 w-full items-center gap-2 rounded-md border px-3 text-left text-sm font-semibold outline-none focus-visible:ring-[3px]">
        <span className="flex-1 truncate">{current.name}</span>
        <ChevronsUpDownIcon className="text-muted-foreground size-4 shrink-0" aria-hidden />
        <span className="sr-only">Switch dealership</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel className="text-muted-foreground text-xs">Dealerships</DropdownMenuLabel>
        {options.map((d) => (
          <DropdownMenuItem key={d.id} asChild>
            <Link href={`/dealer/${d.id}`} aria-current={d.id === current.id ? 'true' : undefined}>
              <span className="flex-1 truncate">{d.name}</span>
              {d.id === current.id ? <CheckIcon aria-hidden /> : null}
            </Link>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/dealer/apply">
            <PlusIcon /> Add a dealership
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
