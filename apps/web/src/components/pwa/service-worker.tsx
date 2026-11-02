'use client';

import { useEffect } from 'react';

/** Registers the service worker (offline page + push alerts) once the page has loaded. */
export function ServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    const register = () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(() => {
        // Private mode and some in-app browsers refuse; the site works the same without it.
      });
    };
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register, { once: true });
  }, []);
  return null;
}
