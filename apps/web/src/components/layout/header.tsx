import Link from 'next/link';
import { CarzaLogo } from '@/components/brand/logo';
import { ThemeToggle } from '@/components/theme/theme-toggle';
import { Button } from '@/components/ui/button';
import { getViewer } from '@/lib/viewer';
import { AccountMenu } from './account-menu';
import { TabLinks } from './tab-links';

export async function Header() {
  const viewer = await getViewer();
  return (
    <header className="bg-background/95 supports-[backdrop-filter]:bg-background/80 sticky top-0 z-40 border-b backdrop-blur">
      <div className="mx-auto grid h-14 max-w-7xl grid-cols-[1fr_auto_1fr] items-center gap-3 px-4 sm:px-6 md:h-16">
        <CarzaLogo size="sm" />
        <nav aria-label="Main" className="hidden md:block">
          <TabLinks variant="header" />
        </nav>
        <div className="col-start-3 flex items-center justify-end gap-1">
          <ThemeToggle />
          {viewer ? (
            <AccountMenu viewer={viewer} />
          ) : (
            <Button asChild size="sm" className="rounded-full">
              <Link href="/sign-in">Sign in</Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
