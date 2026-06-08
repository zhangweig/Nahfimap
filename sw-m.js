/**
 * NahfiMap Mobile PWA Service Worker
 * 策略：Cache First（核心资源） + Stale While Revalidate（地图瓦片）
 */
const CACHE_VERSION = 'nahfimap-m-v2';
const TILE_CACHE    = 'nahfimap-m-tiles-v1';

const CORE_ASSETS = [
  './m.html',
  './manifest-m.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css',
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/leaflet.heat@0.2.0/dist/leaflet-heat.js',
  'https://cdn.jsdelivr.net/npm/vue@3.4.21/dist/vue.global.prod.js',
  'https://cdn.jsdelivr.net/npm/dexie@3.2.4/dist/dexie.min.js',
  'https://cdn.jsdelivr.net/npm/exifr@7.1.3/dist/ics.browser.umd.js',
  'https://cdn.jsdelivr.net/npm/@tmcw/togeojson@5.8.1/dist/togeojson.umd.js',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(CORE_ASSETS).catch(err => console.warn('[SW-M] Pre-cache partial failure:', err)))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_VERSION && k !== TILE_CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Map tiles → Stale While Revalidate
  if (
    url.hostname.includes('amap.com') || url.hostname.includes('autonavi.com') ||
    url.hostname.includes('tile.openstreetmap.org') || url.hostname.includes('tile.opentopomap.org') ||
    url.hostname.includes('basemaps.cartocdn.com') || url.hostname.includes('cartocdn.com')
  ) {
    e.respondWith(tileStrategy(e.request));
    return;
  }

  // CDN → Cache First
  if (url.hostname.includes('cdn.jsdelivr.net')) {
    e.respondWith(cacheFirst(e.request, CACHE_VERSION));
    return;
  }

  // Local → Cache First
  if (url.origin === self.location.origin) {
    e.respondWith(cacheFirst(e.request, CACHE_VERSION));
    return;
  }

  e.respondWith(fetch(e.request).catch(() => new Response('', { status: 200, headers: { 'Content-Type': 'text/plain' } })));
});

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok && request.method === 'GET') cache.put(request, response.clone());
    return response;
  } catch {
    if (request.mode === 'navigate') {
      const fb = await cache.match('./m.html');
      if (fb) return fb;
    }
    if (request.destination === 'image') {
      return new Response('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>', { headers: { 'Content-Type': 'image/svg+xml' } });
    }
    return new Response('', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
}

async function tileStrategy(request) {
  const cache = await caches.open(TILE_CACHE);
  const cached = await cache.match(request);
  const fetchAndCache = fetch(request).then(response => {
    if (response.ok) { cache.put(request, response.clone()); trimCache(TILE_CACHE, 500); }
    return response;
  }).catch(() => null);
  return cached || fetchAndCache || new Response('', { status: 503 });
}

async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) await cache.delete(keys[0]);
}
