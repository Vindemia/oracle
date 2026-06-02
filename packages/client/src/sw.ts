/// <reference lib="webworker" />

// Service worker custom (mode injectManifest de vite-plugin-pwa).
// Lot 1 : precache du shell + stratégies réseau. Les handlers push/notificationclick
// seront ajoutés au Lot 2 (notifications).

import {
  precacheAndRoute,
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  type PrecacheEntry,
} from 'workbox-precaching';
import { registerRoute, NavigationRoute } from 'workbox-routing';
import { NetworkFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';

declare const self: ServiceWorkerGlobalScope & {
  __WB_MANIFEST: (PrecacheEntry | string)[];
};

// Manifeste de precache injecté au build par vite-plugin-pwa.
precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Navigation : sert toujours index.html depuis le precache (SPA),
// sauf pour les routes API.
const handler = createHandlerBoundToURL('/index.html');
registerRoute(new NavigationRoute(handler, { denylist: [/^\/api\//] }));

// Données API : réseau d'abord, repli sur le dernier cache si hors-ligne.
registerRoute(
  ({ url }) => url.pathname.startsWith('/api/'),
  new NetworkFirst({
    cacheName: 'oracle-api',
    networkTimeoutSeconds: 5,
    plugins: [
      new CacheableResponsePlugin({ statuses: [200] }),
      new ExpirationPlugin({ maxEntries: 64, maxAgeSeconds: 60 * 60 * 24 }),
    ],
  }),
);

// Polices Google : cache durable (révalidé en arrière-plan).
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com' || url.origin === 'https://fonts.gstatic.com',
  new StaleWhileRevalidate({ cacheName: 'oracle-fonts' }),
);

// Active immédiatement la nouvelle version sans attendre la fermeture des onglets.
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if ((event.data as { type?: string } | undefined)?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});
