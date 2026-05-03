/// <reference lib="webworker" />
import { precacheAndRoute } from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';

declare const self: ServiceWorkerGlobalScope;

precacheAndRoute(self.__WB_MANIFEST);

// SPA navigation fallback (everything that's not /api goes to index.html)
registerRoute(
  new NavigationRoute(
    async ({ event }) => {
      const cache = await caches.open('shell-v1');
      const cached = await cache.match('/index.html');
      if (cached) return cached;
      return fetch((event as FetchEvent).request);
    },
    { denylist: [/^\/api\//] },
  ),
);

// API: network first with a 5-minute fallback
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'api-v1',
    networkTimeoutSeconds: 8,
    plugins: [
      new ExpirationPlugin({ maxEntries: 128, maxAgeSeconds: 60 * 5 }),
      new CacheableResponsePlugin({ statuses: [0, 200] }),
    ],
  }),
);

// App shell static assets
registerRoute(
  ({ request }) => ['style', 'script', 'worker', 'document'].includes(request.destination),
  new CacheFirst({
    cacheName: 'shell-v1',
    plugins: [
      new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  }),
);

// --- Push notifications -----------------------------------------------------

self.addEventListener('push', (event) => {
  let data: { title: string; body: string; url: string } = {
    title: 'Velvet Scoop',
    body: '',
    url: '/',
  };
  try {
    if (event.data) data = { ...data, ...(event.data.json() as typeof data) };
  } catch {
    // Non-JSON payload — fall back to defaults.
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      data: { url: data.url },
      icon: '/favicon.svg',
      badge: '/favicon.svg',
    }),
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url =
    (event.notification.data as { url?: string } | undefined)?.url ?? '/';
  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of clientList) {
        if (new URL(client.url).origin === self.location.origin) {
          await client.navigate(url).catch(() => undefined);
          return client.focus();
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(url);
    })(),
  );
});
