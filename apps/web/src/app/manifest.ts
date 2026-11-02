import type { MetadataRoute } from 'next';
import { THEME_COLORS } from '@/components/theme/colors';
import { SITE_DESCRIPTION } from '@/lib/site';

/** Lets people add Carza to their home screen and open it full screen like an app. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Carza',
    short_name: 'Carza',
    description: SITE_DESCRIPTION,
    start_url: '/',
    display: 'standalone',
    background_color: THEME_COLORS.dark,
    theme_color: THEME_COLORS.dark,
    icons: [
      { src: '/icon.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  };
}
