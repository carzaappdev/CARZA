'use client';

import { useState, type ComponentProps } from 'react';
import { SlidersHorizontalIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { SearchFilters } from './search-filters';

type Props = Omit<ComponentProps<typeof SearchFilters>, 'autoApply' | 'idPrefix' | 'onApplied'> & {
  activeCount: number;
};

/** Phones: filters open in a full-height sheet and apply when the buyer taps "Show cars". */
export function MobileFilters({ activeCount, ...props }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" className="rounded-full lg:hidden">
          <SlidersHorizontalIcon />
          Filters
          {activeCount > 0 && (
            <span className="bg-primary text-primary-foreground grid size-5 place-items-center rounded-full text-xs">
              {activeCount}
            </span>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent
        side="right"
        aria-describedby={undefined}
        className="w-full max-w-md gap-0 overflow-y-auto p-0"
      >
        <div className="bg-background sticky top-0 border-b px-5 py-4">
          <SheetTitle className="text-lg">Filters</SheetTitle>
        </div>
        <div className="px-5">
          <SearchFilters
            {...props}
            autoApply={false}
            idPrefix="m"
            onApplied={() => setOpen(false)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
