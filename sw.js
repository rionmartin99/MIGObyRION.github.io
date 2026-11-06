/*
 * Version: 9.18.3
 * Change Log:
 * [Nov 06, 2026 01:25 PM] Feature: Implemented decoupled dual-loop vision control with Schmitt trigger hysteresis, 30Hz deterministic trajectory engine, and progressive breakaway ramping for smooth jitter-free robot tracking.
 * [Nov 06, 2026 04:30 AM] Fix: Restored active production Gemini 2.0/1.5 models to fix HTTP 404 errors, resolved simulation variable redeclaration diagnostics, and added motor slew-rate ramping, soft-start deadband, and 85ms BLE heartbeat for smooth jitter-free robot motion.
 * [Nov 06, 2026 03:25 AM] Fix: Resolved HTTP 404 Gemini API connectivity error by adding dynamic ListModels auto-discovery fallback and fixing multimodal image payload injection in Super AIONA stream handler.
 * [Nov 05, 2026 10:15 PM] Feature: Upgraded AI core with automatic multi-model background fallback and enabled photo upload with intelligent visual feedback in AIONA companion chat.
 * [Nov 04, 2026 10:00 PM] Feature: Enhanced Color Tracker and Optical Line Follower accuracy with Otsu dynamic thresholding, spatial cluster rejection, and 1€ adaptive de-jitter filtering across all AI perception models.
 */

// MIGO Controller Service Worker v9.18.3
const APP_CACHE_NAME = 'migo-controller-cache-v9.18.3';
const AI_MODEL_CACHE_NAME = 'migo-ai-models-persistent-v1';

// Core local assets to cache on install
const STATIC_ASSETS = [
  './',
  './index.html',
  './MIGOMultiCOntrol.html',
  './manifest.json',
  './lib/blockly/blockly_compressed.js',
  './lib/blockly/blocks_compressed.js',
  './lib/blockly/javascript_compressed.js',
  './lib/blockly/msg/en.js'
];

// Helper: Determine if a request belongs to AI models, neural weights, or TF.js libraries
function isAIResource(url) {
  const href = url.href.toLowerCase();
  const path = url.pathname.toLowerCase();
  const host = url.hostname.toLowerCase();

  return (
    host.includes('tfhub.dev') ||
    host.includes('storage.googleapis.com') ||
    host.includes('kaggle.com') ||
    (host.includes('cdn.jsdelivr.net') && (path.includes('@tensorflow') || path.includes('tfjs'))) ||
    (host.includes('unpkg.com') && (path.includes('@tensorflow') || path.includes('tfjs'))) ||
    path.endsWith('.bin') ||
    (path.endsWith('.json') && (path.includes('model') || path.includes('savedmodel') || path.includes('tfjs') || path.includes('shard'))) ||
    href.includes('tfjs-format=file')
  );
}

// Install Event - Pre-cache core app shell files & activate immediately
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(APP_CACHE_NAME).then(async (cache) => {
      console.log('[MIGO ServiceWorker] Pre-caching core app shell v9.10.0');
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

// Activate Event - Clean up stale app caches, but PRESERVE AI_MODEL_CACHE_NAME!
self.addEventListener('activate', (event) => {
  const PRESERVED_CACHES = [APP_CACHE_NAME, AI_MODEL_CACHE_NAME];
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (!PRESERVED_CACHES.includes(cacheName)) {
            console.log('[MIGO ServiceWorker] Removing old app cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Message Event - Handle explicit model cache queries & manual updates
self.addEventListener('message', async (event) => {
  if (!event.data) return;

  if (event.data.action === 'CLEAR_AI_MODELS') {
    try {
      await caches.delete(AI_MODEL_CACHE_NAME);
      console.log('[MIGO ServiceWorker] AI Model Cache cleared upon user update request.');
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: true, message: 'AI model cache cleared' });
      }
    } catch (e) {
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: false, error: e.message });
      }
    }
  } else if (event.data.action === 'GET_AI_CACHE_STATUS') {
    try {
      const cache = await caches.open(AI_MODEL_CACHE_NAME);
      const keys = await cache.keys();
      const urls = keys.map(k => k.url.toLowerCase());
      const hasFace = urls.some(u => u.includes('blazeface'));
      const hasHand = urls.some(u => u.includes('handpose') || u.includes('handdetector') || u.includes('handskeleton'));
      const hasObject = urls.some(u => u.includes('coco-ssd') || u.includes('ssdlite'));
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({
          success: true,
          itemCount: keys.length,
          hasFace,
          hasHand,
          hasObject
        });
      }
    } catch (e) {
      if (event.ports && event.ports[0]) {
        event.ports[0].postMessage({ success: false, itemCount: 0 });
      }
    }
  }
});

// Fetch Event - Dedicated 2-Tier Strategy
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests, WebSockets, or unsupported protocols
  if (req.method !== 'GET' || url.protocol.startsWith('ws') || !url.protocol.startsWith('http')) {
    return;
  }

  // Skip dynamic robot hardware endpoint commands or streaming paths
  if (url.pathname.includes('/cmd') || url.pathname.includes('/api') || url.pathname.includes('/ws') || url.pathname.includes('/stream') || url.pathname.includes('/camera-stream')) {
    return;
  }

  // 1. AI Models, Neural Weights & TF.js Dependencies -> Dedicated Persistent AI Cache
  if (isAIResource(url)) {
    event.respondWith(
      caches.open(AI_MODEL_CACHE_NAME).then(async (cache) => {
        // Cache-First: Always return cached response if available (0ms offline load)
        const cachedResponse = await cache.match(req);
        if (cachedResponse) {
          return cachedResponse;
        }

        // Not cached yet: Fetch from network and store permanently
        try {
          const networkResponse = await fetch(req);
          // Store both standard CORS (status 200) and opaque cross-origin CDN responses
          if (networkResponse && (networkResponse.status === 200 || networkResponse.type === 'opaque')) {
            cache.put(req, networkResponse.clone());
          }
          return networkResponse;
        } catch (fetchErr) {
          // Fallback check in case of URL variations or search params
          const fallback = await cache.match(req, { ignoreSearch: true });
          if (fallback) return fallback;
          console.warn('[MIGO ServiceWorker] AI model asset fetch failed offline:', req.url);
          throw fetchErr;
        }
      })
    );
    return;
  }

  // 2. Network-First for Navigation and index.html to guarantee latest app shell
  if (req.mode === 'navigate' || url.pathname.endsWith('index.html') || url.pathname === '/' || url.pathname.endsWith('/')) {
    event.respondWith(
      fetch(req).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200) {
          const responseToCache = networkResponse.clone();
          caches.open(APP_CACHE_NAME).then((cache) => cache.put(req, responseToCache));
        }
        return networkResponse;
      }).catch(() => caches.match(req))
    );
    return;
  }

  // 3. Stale-While-Revalidate for local libraries, fonts, and static assets in APP_CACHE_NAME
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req).then((networkResponse) => {
        if (networkResponse && networkResponse.status === 200 && networkResponse.type !== 'opaque') {
          const responseToCache = networkResponse.clone();
          caches.open(APP_CACHE_NAME).then((cache) => cache.put(req, responseToCache));
        }
        return networkResponse;
      }).catch(() => {});
      return cachedResponse || fetchPromise;
    })
  );
});
