'use client';

import { useEffect, useRef } from 'react';
import type { Route } from 'next';
import { usePathname, useRouter } from 'next/navigation';
import { safeNextPath } from '@carza/shared';
import { closeInAppBrowser, isNativeApp, NATIVE_AUTH_REDIRECT, onNative } from '@/lib/native';
import { nativePushWasOn, saveNativePush } from '@/lib/push-client';

/**
 * Glue for the Carza iPhone app; renders nothing and does nothing in a browser.
 * - Finishes Google/Apple sign-in when the in-app Safari sheet hands back to the app.
 * - Opens the right page when someone taps a push alert.
 * - Keeps this phone's push token saved for whoever is signed in (after sign-in, or if Apple rotates it).
 */
export function NativeBridge() {
  const router = useRouter();
  const pathname = usePathname();
  const pushSaved = useRef(false);

  useEffect(() => {
    if (!isNativeApp()) return;
    const listeners = [
      onNative<{ url: string }>('App', 'appUrlOpen', ({ url }) => {
        if (!url.startsWith(NATIVE_AUTH_REDIRECT)) return;
        closeInAppBrowser();
        // The PKCE verifier lives in this web view's cookies, so the code is exchanged here. A full
        // load on purpose: /auth/callback is a route handler that sets the session cookies.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.assign(`/auth/callback${new URL(url).search}`);
      }),
      onNative<{ notification: { data?: { url?: unknown } } }>(
        'PushNotifications',
        'pushNotificationActionPerformed',
        ({ notification }) => {
          const url = notification.data?.url;
          if (typeof url === 'string') router.push(safeNextPath(url) as Route);
        },
      ),
    ];
    return () => listeners.forEach((l) => void l?.remove());
  }, [router]);

  useEffect(() => {
    if (pushSaved.current || !nativePushWasOn()) return;
    void saveNativePush(false).then((error) => {
      if (!error) pushSaved.current = true;
    });
  }, [pathname]);

  return null;
}
