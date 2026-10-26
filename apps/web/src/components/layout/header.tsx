import Link from 'next/link';
import { PlusIcon, SearchIcon } from 'lucide-react';
import { CarzaLogo } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { Button } from '@/components/ui/button';
import { getViewer } from '@/lib/viewer';
import { AccountMenu } from './account-menu';

export async function Header() {
  const viewer = await getViewer();
  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6">
        <CarzaLogo size="sm" />

        {/* Plain GET form: works without JS and lands on a shareable /search URL. */}
        <form action="/search" role="search" className="mx-2 hidden max-w-md flex-1 md:block">
          <label htmlFor="header-search" className="sr-only">
            Search cars
          </label>
          <div className="relative">
            <SearchIcon
              aria-hidden
              className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            />
            <input
              id="header-search"
              name="q"
              type="search"
              placeholder="Make, model or keyword"
              className="bg-muted/60 focus-visible:ring-ring/50 h-10 w-full rounded-full border pr-4 pl-9 text-sm outline-none focus-visible:ring-[3px]"
            />
          </div>
        </form>

        <div className="ml-auto flex items-center gap-1">
          <Button asChild size="sm" className="hidden rounded-full md:inline-flex">
            <Link href="/account/listings/new">
              <PlusIcon /> Sell your car
            </Link>
          </Button>
          <ThemeToggle />
          {viewer ? (
            <AccountMenu viewer={viewer} />
          ) : (
            <Button asChild variant="ghost" className="min-h-11">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
