'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowLeftIcon, MenuIcon } from 'lucide-react';
import { CarzaLogo } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { DealershipSwitcher, type DealershipOption } from './dealership-switcher';
import { dealerNav } from './nav';
import { NavLinks } from './nav-links';

type Props = { current: DealershipOption; options: DealershipOption[] };

function SidebarBody({ current, options, onNavigate }: Props & { onNavigate?: () => void }) {
  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <CarzaLogo size="sm" />
      <DealershipSwitcher current={current} options={options} />
      <NavLinks items={dealerNav(current.id)} label="Dealer dashboard" onNavigate={onNavigate} />
      <div className="mt-auto flex items-center justify-between">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground flex min-h-11 items-center gap-2 px-3 text-sm"
        >
          <ArrowLeftIcon className="size-4" aria-hidden /> Back to Carza
        </Link>
        <ThemeToggle />
      </div>
    </div>
  );
}

/** Fixed sidebar on desktop; a menu button that opens it as a sheet on phones. */
export function DealerSidebar(props: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <aside className="bg-muted/30 sticky top-0 hidden h-dvh w-64 shrink-0 border-r md:block">
        <SidebarBody {...props} />
      </aside>
      <div className="bg-background/95 sticky top-0 z-40 flex h-14 items-center gap-2 border-b px-2 backdrop-blur md:hidden">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Open dashboard menu">
              <MenuIcon className="size-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" aria-describedby={undefined}>
            <SheetTitle className="sr-only">Dealer dashboard menu</SheetTitle>
            <SidebarBody {...props} onNavigate={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
        <span className="truncate text-sm font-semibold">{props.current.name}</span>
      </div>
    </>
  );
}
