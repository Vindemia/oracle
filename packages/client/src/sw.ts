/// <reference lib="webworker" />

// Service worker custom (mode injectManifest de vite-plugin-pwa) :
// precache du shell + stratégies réseau + réception des présages (Web Push).

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

// Présages : affiche la notification depuis le payload JSON envoyé par le serveur.
interface PushPayload {
  title?: string;
  body?: string;
  url?: string;
  tag?: string;
}

self.addEventListener('push', (event: PushEvent) => {
  let payload: PushPayload = {};
  try {
    payload = (event.data?.json() as PushPayload | null) ?? {};
  } catch {
    // payload non-JSON — on affiche un présage générique
  }

  const options: NotificationOptions = {
    body: payload.body ?? '',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    data: { url: payload.url ?? '/' },
    ...(payload.tag !== undefined ? { tag: payload.tag } : {}),
  };

  event.waitUntil(
    self.registration.showNotification(payload.title ?? "L'Oracle murmure…", options),
  );
});

// Clic sur un présage : focus d'une fenêtre existante (navigée vers l'URL cible)
// ou ouverture d'une nouvelle fenêtre.
self.addEventListener('notificationclick', (event: NotificationEvent) => {
  event.notification.close();
  const url = (event.notification.data as { url?: string } | null)?.url ?? '/';

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const existing = windows[0];
      if (existing) {
        await existing.focus();
        await existing.navigate(url).catch(() => undefined);
        return;
      }
      await self.clients.openWindow(url);
    })(),
  );
});

// Active immédiatement la nouvelle version sans attendre la fermeture des onglets.
self.addEventListener('message', (event: ExtendableMessageEvent) => {
  if ((event.data as { type?: string } | undefined)?.type === 'SKIP_WAITING') {
    void self.skipWaiting();
  }
});
