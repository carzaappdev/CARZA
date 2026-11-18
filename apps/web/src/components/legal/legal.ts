import type { Route } from 'next';

/** Bump when any legal page changes in substance. Shown at the top of each page. */
export const LEGAL_UPDATED = 'November 18, 2026';

export const LEGAL_LINKS: { href: Route; label: string }[] = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/guidelines', label: 'Community Guidelines' },
  { href: '/support', label: 'Support' },
];

/** Public contact address for support, privacy and legal requests (also the App Store support contact). */
export const CONTACT_EMAIL: string | null = 'support@carzaapp.com';
