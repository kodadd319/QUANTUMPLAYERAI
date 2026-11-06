const CACHE_NAME = 'quantumplayerai-v3';

// Core essential assets to precache immediately on install
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon.png',
  '/logo.png',
  '/mahogany_bg.jpg',
  '/pwa-192x192.png',
  '/pwa-512x512.png',
  '/pwa-maskable-512x512.png',
  '/apple-touch-icon.png'
];

// Install: precache core app assets and activate immediately
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Use map to allow individual items to resolve even if one fails
      return Promise.allSettled(
        CORE_ASSETS.map((asset) =>
          cache.add(asset).catch((err) => {
            console.warn(`[SW] Precache skipped for ${asset}:`, err);
          })
        )
      );
    })
  );
  self.skipWaiting();
});

// Activate: clean up outdated caches and claim clients immediately
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((name) => {
          if (name !== CACHE_NAME) {
            console.log('[SW] Deleting legacy cache:', name);
            return caches.delete(name);
          }
        })
      );
    })
  );
  self.clients.claim();
});

// Fetch: serve cached resources first or stale-while-revalidate for 100% offline availability
self.addEventListener('fetch', (event) => {
  const { request } = event;

  // Ignore non-HTTP/HTTPS (e.g. chrome-extension, blob, data)
  if (!request.url.startsWith('http://') && !request.url.startsWith('https://')) {
    return;
  }

  // Never intercept Vite internal dev modules, HMR, or virtual paths
  if (
    request.url.includes('/@vite') ||
    request.url.includes('/@fs') ||
    request.url.includes('/@id') ||
    request.url.includes('?t=') ||
    request.url.includes('/@vite-plugin-pwa') ||
    request.url.includes('hot-update')
  ) {
    return;
  }

  // Handle SPA Navigation requests (HTML pages)
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseClone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put('/index.html', responseClone);
            });
          }
          return networkResponse;
        })
        .catch(() => {
          // Completely offline: serve cached index.html immediately
          return caches.match('/index.html').then((cached) => {
            return cached || caches.match('/');
          });
        })
    );
    return;
  }

  // Handle API calls (/api/*)
  if (request.url.includes('/api/')) {
    event.respondWith(
      fetch(request).catch(() => {
        // Return offline JSON message for API endpoints
        return new Response(
          JSON.stringify({ offline: true, error: 'App is running in offline mode.' }),
          {
            status: 503,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      })
    );
    return;
  }

  // Handle static assets (JS chunks, CSS, fonts, images, web workers)
  event.respondWith(
    caches.match(request).then((cachedResponse) => {
      // 1. If found in cache, return it immediately
      if (cachedResponse) {
        // Asynchronously update in background if online (Stale-While-Revalidate)
        if (navigator.onLine) {
          fetch(request)
            .then((networkResponse) => {
              if (networkResponse && networkResponse.status === 200) {
                const clone = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                  cache.put(request, clone);
                });
              }
            })
            .catch(() => {});
        }
        return cachedResponse;
      }

      // 2. If not in cache, fetch from network and cache the response
      return fetch(request)
        .then((networkResponse) => {
          if (!networkResponse || networkResponse.status !== 200) {
            return networkResponse;
          }
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(request, responseToCache);
          });
          return networkResponse;
        })
        .catch(() => {
          // If offline and requesting an image, return cached icon fallback if available
          if (request.destination === 'image') {
            return caches.match('/icon.png');
          }
          return new Response('', { status: 408, statusText: 'Offline' });
        });
    })
  );
});
