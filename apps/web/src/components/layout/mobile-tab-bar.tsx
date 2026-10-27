import { TabLinks } from './tab-links';

/** Fixed bottom tabs on phones. The site shell pads the page so content never hides under it. */
export function MobileTabBar() {
  return (
    <nav
      aria-label="Main"
      className="bg-background/95 supports-[backdrop-filter]:bg-background/80 fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      <TabLinks variant="bar" />
    </nav>
  );
}
