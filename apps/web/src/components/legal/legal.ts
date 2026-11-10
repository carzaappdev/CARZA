import type { Route } from 'next';
import { clientEnv } from '@/env/client';

/** Bump when any legal page changes in substance. Shown at the top of each page. */
export const LEGAL_UPDATED = 'November 10, 2026';

export const LEGAL_LINKS: { href: Route; label: string }[] = [
  { href: '/terms', label: 'Terms' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/guidelines', label: 'Community Guidelines' },
  { href: '/copyright', label: 'Copyright' },
  { href: '/takedown', label: 'Remove an intimate image' },
  { href: '/contact', label: 'Contact' },
];

/** Public contact address for privacy and legal requests. Null until it's set in the environment. */
export const CONTACT_EMAIL: string | null = clientEnv.NEXT_PUBLIC_CONTACT_EMAIL ?? null;
/** The company behind Carza and its postal address, for the legal pages. */
export const LEGAL_NAME: string = clientEnv.NEXT_PUBLIC_LEGAL_NAME ?? 'Carza';
export const LEGAL_ADDRESS: string | null = clientEnv.NEXT_PUBLIC_LEGAL_ADDRESS ?? null;
