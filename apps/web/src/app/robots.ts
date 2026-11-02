import type { MetadataRoute } from 'next';
import { clientEnv } from '@/env/client';

/** Crawlers get the public tabs, posts, profiles and events; private and account pages stay out. */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/account', '/auth', '/notifications', '/welcome', '/*/edit'],
    },
    sitemap: new URL('/sitemap.xml', clientEnv.NEXT_PUBLIC_SITE_URL).toString(),
  };
}
