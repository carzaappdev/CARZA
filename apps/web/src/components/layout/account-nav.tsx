'use client';

import { ACCOUNT_NAV } from './nav';
import { NavLinks } from './nav-links';

// A client module because nav items carry icon components, which can't cross the server/client boundary.
/** Account sections: a sidebar on desktop, scrolling tabs on phones. */
export function AccountNav() {
  return (
    <>
      <div className="hidden md:block">
        <NavLinks items={ACCOUNT_NAV} label="Account" />
      </div>
      <div className="md:hidden">
        <NavLinks items={ACCOUNT_NAV} label="Account" orientation="horizontal" />
      </div>
    </>
  );
}
