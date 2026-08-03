// MIGO Controller Service Worker v8.8.0
const CACHE_NAME = 'migo-controller-cache-v8.8.0';

// Core local assets to cache on install
const STATIC_ASSETS = [
  './',
  './index.html',
  './MIGOMultiCOntrol.html',
  './migo_competition.html',
  './manifest.json',
  './lib/blockly/blockly_compressed.js',
  './lib/blockly/blocks_compressed.js',
  './lib/blockly/javascript_compressed.js',
  './lib/blockly/msg/en.js'
];

// Install Event - Pre-cache core files
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[MIGO ServiceWorker] Pre-caching core app shell');
      for (const asset of STATIC_ASSETS) {
        try {
          await cache.add(asset);
        } catch (err) {
          console.warn('[MIGO ServiceWorker] Pre-cache skipped for asset:', asset, err);
        }
      }
    })
  );
});

// Activate Event - Clean up stale caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('[MIGO ServiceWorker] Removing old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch Event - Cache First with Network Fallback & Background Update
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests, WebSockets, or browser extensions
  if (req.method !== 'GET' || url.protocol.startsWith('ws') || !url.protocol.startsWith('http')) {
    return;
  }

  // Skip dynamic robot endpoint commands or streaming paths
  if (url.pathname.includes('/cmd') || url.pathname.includes('/api') || url.pathname.includes('/ws') || url.pathname.includes('/stream')) {
    return;
  }

  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      // Fetch fresh version from network in background (stale-while-revalidate)
      const fetchPromise = fetch(req).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'opaque') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, responseToCache));
        }
        return networkResponse;
      }).catch((err) => {
        console.log('[MIGO ServiceWorker] Offline request fallback:', req.url);
      });

      // Return cached asset immediately if available, otherwise wait for network fetch
      return cachedResponse || fetchPromise;
    })
  );
});
