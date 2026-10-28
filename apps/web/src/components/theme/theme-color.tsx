'use client';

import { useTheme } from 'next-themes';
import { useEffect } from 'react';
import { THEME_COLORS } from './colors';

/**
 * The viewport `theme-color` tags follow the device setting. When someone picks a theme by hand, point
 * them all at that theme so the phone's status bar matches the app instead of the system.
 */
export function ThemeColor() {
  const { resolvedTheme } = useTheme();
  useEffect(() => {
    if (resolvedTheme !== 'light' && resolvedTheme !== 'dark') return;
    document
      .querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]')
      .forEach((meta) => meta.setAttribute('content', THEME_COLORS[resolvedTheme]));
  }, [resolvedTheme]);
  return null;
}
