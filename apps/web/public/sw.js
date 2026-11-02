// Carza service worker: an offline page for when the network drops, and web push alerts.
// Deliberately caches nothing else: the feed is live data and Next already caches its own assets.
const CACHE = 'carza-offline-v1';
const OFFLINE_URL = '/offline';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.add(new Request(OFFLINE_URL, { cache: 'reload' })))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// Page loads only: if the network fails, show the offline page instead of the browser's error.
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;
  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(OFFLINE_URL).then((page) => page || Response.error()),
    ),
  );
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }
  const title = data.title || 'Carza';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      tag: data.tag,
      renotify: Boolean(data.tag),
      icon: '/icons/icon-192.png',
      badge: '/icons/badge-96.png',
      data: { url: sameOriginPath(data.url) },
    }),
  );
});

// Open the notification's page, reusing a Carza window when one is already open.
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = new URL(
    sameOriginPath(event.notification.data && event.notification.data.url),
    self.location.origin,
  ).href;
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windows) => {
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) return open.navigate(url).then((w) => (w || open).focus());
      return self.clients.openWindow(url);
    }),
  );
});

// Only ever open pages on this site.
function sameOriginPath(url) {
  return typeof url === 'string' && url.startsWith('/') && !url.startsWith('//')
    ? url
    : '/notifications';
}
