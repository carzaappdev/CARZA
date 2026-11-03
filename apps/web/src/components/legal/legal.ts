import type { Route } from 'next';

/** Bump when any legal page changes in substance. Shown at the top of each page. */
export const LEGAL_UPDATED = 'November 2, 2026';

export const LEGAL_LINKS: { href: Route; label: string }[] = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/guidelines', label: 'Community Guidelines' },
];

/** Public contact address for privacy and legal requests. Null until the owner picks one. */
export const CONTACT_EMAIL: string | null = null;
