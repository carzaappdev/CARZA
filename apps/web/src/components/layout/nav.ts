import type { Route } from 'next';
import {
  CalendarClockIcon,
  CalendarDaysIcon,
  CarFrontIcon,
  ClapperboardIcon,
  HomeIcon,
  LayoutDashboardIcon,
  MessageSquareIcon,
  SettingsIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react';

export const SEARCH_HREF: Route = '/search';

export type NavItem = { href: Route; label: string; Icon: LucideIcon; exact?: boolean };

/** The app's three tabs: bottom bar on phones, header links on larger screens. */
export const TAB_BAR: NavItem[] = [
  { href: '/', label: 'Feed', Icon: HomeIcon, exact: true },
  { href: '/reels', label: 'Reels', Icon: ClapperboardIcon },
  { href: '/events', label: 'Events', Icon: CalendarDaysIcon },
];

/** The account area's section nav. */
export const ACCOUNT_NAV: NavItem[] = [
  { href: '/account/settings', label: 'Settings', Icon: SettingsIcon },
];

/** The dealer dashboard sidebar, for one dealership. Hidden for launch (see route-guard). */
export function dealerNav(dealershipId: string): NavItem[] {
  // Typed routes can't check a runtime id against `[dealershipId]`, so these hrefs are asserted.
  const at = (path = '') => `/dealer/${dealershipId}${path}` as Route;
  return [
    { href: at(), label: 'Dashboard', Icon: LayoutDashboardIcon, exact: true },
    { href: at('/inventory'), label: 'Inventory', Icon: CarFrontIcon },
    { href: at('/leads'), label: 'Leads', Icon: MessageSquareIcon },
    { href: at('/test-drives'), label: 'Test drives', Icon: CalendarClockIcon },
    { href: at('/team'), label: 'Team', Icon: UsersIcon },
    { href: at('/settings'), label: 'Settings', Icon: SettingsIcon },
  ];
}

/** Whether `item` is the current section of `pathname`. */
export function isActive(item: NavItem, pathname: string, items: NavItem[]) {
  const matches = (i: NavItem) =>
    i.exact ? pathname === i.href : pathname === i.href || pathname.startsWith(`${i.href}/`);
  if (!matches(item)) return false;
  // When two items match (/account and /account/settings), the longest href wins.
  return !items.some(
    (other) => other !== item && other.href.length > item.href.length && matches(other),
  );
}
