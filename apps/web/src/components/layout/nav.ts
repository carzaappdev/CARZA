import type { Route } from 'next';
import {
  CalendarClockIcon,
  CarFrontIcon,
  HeartIcon,
  HomeIcon,
  LayoutDashboardIcon,
  MessageSquareIcon,
  PlusCircleIcon,
  SearchIcon,
  SettingsIcon,
  UserIcon,
  UsersIcon,
  type LucideIcon,
} from 'lucide-react';

// /search is built in the marketplace PR. Asserted so this shell type-checks before that lands.
export const SEARCH_HREF = '/search' as Route;

export type NavItem = { href: Route; label: string; Icon: LucideIcon; exact?: boolean };

/** Bottom tab bar on phones (public + account areas). */
export const TAB_BAR: NavItem[] = [
  { href: '/', label: 'Home', Icon: HomeIcon, exact: true },
  { href: SEARCH_HREF, label: 'Search', Icon: SearchIcon },
  { href: '/account/listings/new', label: 'Sell', Icon: PlusCircleIcon },
  { href: '/account/messages', label: 'Messages', Icon: MessageSquareIcon },
  { href: '/account', label: 'Account', Icon: UserIcon },
];

/** The account area's section nav (also the account menu's links). */
export const ACCOUNT_NAV: NavItem[] = [
  { href: '/account/listings', label: 'Your listings', Icon: CarFrontIcon },
  { href: '/account/messages', label: 'Messages', Icon: MessageSquareIcon },
  { href: '/account/test-drives', label: 'Test drives', Icon: CalendarClockIcon },
  { href: '/account/saved', label: 'Saved', Icon: HeartIcon },
  { href: '/account/settings', label: 'Settings', Icon: SettingsIcon },
];

/** The dealer dashboard sidebar, for one dealership. */
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
  // When two items match (/account and /account/listings/new), the longest href wins.
  return !items.some(
    (other) => other !== item && other.href.length > item.href.length && matches(other),
  );
}
