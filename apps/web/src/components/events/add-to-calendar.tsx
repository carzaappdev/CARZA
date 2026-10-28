'use client';

import { CalendarPlusIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

export function AddToCalendar({ icsHref, googleHref }: { icsHref: string; googleHref: string }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="h-11 flex-1 rounded-xl">
          <CalendarPlusIcon /> Add to calendar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuItem asChild>
          <a href={icsHref} download>
            Apple or Outlook
          </a>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <a href={googleHref} target="_blank" rel="noopener noreferrer">
            Google Calendar
          </a>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
