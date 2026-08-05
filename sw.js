// MIGO Controller Service Worker v8.10.1
const CACHE_NAME = 'migo-controller-cache-v8.10.1';

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

// Install Event - Pre-cache core files & activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(async (cache) => {
      console.log('[MIGO ServiceWorker] Pre-caching core app shell v8.10.1');
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

// Activate Event - Clean up all stale caches
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

// Fetch Event - Network First for index.html / HTML pages, Cache First for static libraries
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

  // Network First for index.html to prevent stale cache issues
  if (req.mode === 'navigate' || url.pathname.endsWith('index.html') || url.pathname === '/' || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(req).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, responseToCache));
        }
        return networkResponse;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // Stale-While-Revalidate for libraries and static assets
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'opaque') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, responseToCache));
        }
        return networkResponse;
      }).catch(() => {});
      return cachedResponse || fetchPromise;
    })
  );
});
