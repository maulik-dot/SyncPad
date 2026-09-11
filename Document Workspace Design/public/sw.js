// SyncPad Service Worker (sw.js) v6 - offline assets & CDN caching
const CACHE_NAME = 'syncpad-v6-cache';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/app.css',
  '/js/offline/syncpad-offline.js',
  '/js/doc/latex-compiler.js',
  '/js/crdt/syncpad-crdt.js',
  '/js/pdf/pdf-engine.js',
  '/js/ai/ai-assistant.js',
  '/js/export/document-model.js',
  '/js/export/pdf-exporter.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-192.svg',
  '/icons/icon-512.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS).catch(err => {
        console.warn('Failed to pre-cache some assets:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.map(key => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);

  if (url.pathname.startsWith('/ws')) {
    return;
  }

  // Bypass service worker for AI streaming/generation and non-GET to avoid breaking SSE
  if (request.method !== 'GET' || url.pathname.startsWith('/api/ai/')) {
    return;
  }

  if (url.pathname.startsWith('/api') || url.pathname.startsWith('/documents') || url.pathname.startsWith('/workspaces') || url.pathname.startsWith('/auth')) {
    event.respondWith(
      fetch(request).catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cachedResponse => {
      const fetchPromise = fetch(request).then(networkResponse => {
        if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque') && (networkResponse.type === 'basic' || networkResponse.type === 'cors')) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
