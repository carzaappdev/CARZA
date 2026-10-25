import Link from 'next/link';
import { CarzaLogo } from '@/components/brand/logo';
import { SEARCH_HREF } from '@/components/layout/nav';

export function Footer() {
  return (
    <footer className="border-t">
      <div className="text-muted-foreground mx-auto flex max-w-7xl flex-col gap-6 px-4 py-10 text-sm sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex flex-col gap-2">
          <CarzaLogo size="sm" />
          <p>Buy and sell cars, locally.</p>
        </div>
        <nav aria-label="Footer">
          <ul className="flex flex-wrap gap-x-6 gap-y-2">
            <li>
              <Link href={SEARCH_HREF} className="hover:text-foreground">
                Browse cars
              </Link>
            </li>
            <li>
              <Link href="/account/listings/new" className="hover:text-foreground">
                Sell your car
              </Link>
            </li>
            <li>
              <Link href="/dealer" className="hover:text-foreground">
                For dealers
              </Link>
            </li>
          </ul>
        </nav>
        <p>© {new Date().getFullYear()} Carza</p>
      </div>
    </footer>
  );
}
