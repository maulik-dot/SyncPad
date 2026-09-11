// SyncPad Service Worker (sw.js) v4 - network first for html & cache bust
const CACHE_NAME = 'syncpad-v4-cache';
// SyncPad Service Worker (sw.js) v5 - network first for html & cache bust
const CACHE_NAME = 'syncpad-v5-cache';
// SyncPad Service Worker (sw.js) v6 - network first for html & cache bust
const CACHE_NAME = 'syncpad-v6-cache';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/app.css',
  '/js/offline/syncpad-offline.js',
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

  // HTML navigation requests: Network-first to always serve latest code, cache fallback for offline
  if (request.mode === 'navigate' || url.pathname === '/' || url.pathname === '/index.html') {
    event.respondWith(
      fetch(request).then(networkResponse => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, responseToCache));
        }
        return networkResponse;
      }).catch(async () => {
        const cached = await caches.match('/index.html') || await caches.match('/');
        return cached;
      })
    );
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
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
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
