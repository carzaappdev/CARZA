import type { MetadataRoute } from 'next';
import { THEME_COLORS } from '@/components/theme/colors';
import { SITE_DESCRIPTION } from '@/lib/site';

const ICON = [{ src: '/icons/icon-192.png', sizes: '192x192' }];

/** Lets people add Carza to their home screen and open it full screen like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Carza',
    short_name: 'Carza',
    description: SITE_DESCRIPTION,
    start_url: '/',
    scope: '/',
    display: 'standalone',
    // Dark splash screen on Android, close to the icon's own background.
    background_color: THEME_COLORS.dark,
    theme_color: THEME_COLORS.dark,
    categories: ['social', 'lifestyle'],
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
    // Long-press the home-screen icon to jump straight to a tab.
    shortcuts: [
      { name: 'Reels', url: '/reels', icons: ICON },
      { name: 'Events', url: '/events', icons: ICON },
      { name: 'Notifications', url: '/notifications', icons: ICON },
    ],
  };
}
