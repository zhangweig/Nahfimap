/**
 * NahfiMap Service Worker
 * 策略：Cache First（核心资源） + Network First（地图瓦片）
 */
const CACHE_VERSION = 'nahfimap-v6';
const TILE_CACHE    = 'nahfimap-tiles-v6';

// 核心静态资源 - 离线时从缓存读取
const CORE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // CDN 依赖（首次加载后缓存）
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css',
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/leaflet.heat@0.2.0/dist/leaflet-heat.js',
  'https://cdn.jsdelivr.net/npm/vue@3.4.21/dist/vue.global.prod.js',
  'https://cdn.jsdelivr.net/npm/dexie@3.2.4/dist/dexie.min.js',
  'https://cdn.jsdelivr.net/npm/exifr@7.1.3/dist/ics.browser.umd.js',
  'https://cdn.jsdelivr.net/npm/@tmcw/togeojson@5.8.1/dist/togeojson.umd.js',
];

// ── Install: 预缓存核心资源 ──────────────────────────────────────
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_VERSION)
      .then(cache => cache.addAll(CORE_ASSETS).catch(err => {
        console.warn('[SW] Pre-cache partial failure:', err);
      }))
      .then(() => self.skipWaiting())
  );
});

// ── Message: 接收 skipWaiting 指令 ──────────────────────────────────
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// ── Activate: 清理旧缓存 ─────────────────────────────────────────
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_VERSION && k !== TILE_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

// ── Fetch: 分策略处理 ────────────────────────────────────────────
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // 1. 地图瓦片 → Stale While Revalidate（有缓存先用，后台更新）
  if (
    url.hostname.includes('amap.com') ||
    url.hostname.includes('autonavi.com') ||
    url.hostname.includes('tile.openstreetmap.org') ||
    url.hostname.includes('tile.opentopomap.org') ||
    url.hostname.includes('basemaps.cartocdn.com') ||
    url.hostname.includes('cartocdn.com')
  ) {
    e.respondWith(tileStrategy(e.request));
    return;
  }

  // 2. CDN 资源 → Cache First（版本号锁定，不会变）
  if (url.hostname.includes('cdn.jsdelivr.net')) {
    e.respondWith(cacheFirst(e.request, CACHE_VERSION));
    return;
  }

  // 3. 本地资源 → Cache First，回退到网络
  if (url.origin === self.location.origin || e.request.url.startsWith('file://')) {
    e.respondWith(cacheFirst(e.request, CACHE_VERSION));
    return;
  }

  // 4. 其他 → 直接网络
  e.respondWith(fetch(e.request).catch(() => new Response('', { status: 503 })));
});

// ── 策略函数 ──────────────────────────────────────────────────────

/** Cache First: 缓存命中直接返回，否则网络请求并缓存 */
async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok && request.method === 'GET') {
      cache.put(request, response.clone());
    }
    return response;
  } catch (err) {
    // 离线且无缓存：导航请求回退到 index.html，其他请求静默失败
    if (request.mode === 'navigate') {
      const fallback = await cache.match('./index.html');
      if (fallback) return fallback;
    }
    // 对于图片等非关键资源，返回 1x1 透明占位，不报错
    if (request.destination === 'image') {
      return new Response('<svg xmlns="http://www.w3.org/2000/svg" width="1" height="1"/>', {
        headers: { 'Content-Type': 'image/svg+xml' }
      });
    }
    return new Response('', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }
}

/** Tile Strategy: Stale-While-Revalidate，最多缓存 500 张瓦片 */
async function tileStrategy(request) {
  const cache = await caches.open(TILE_CACHE);
  const cached = await cache.match(request);

  // 后台更新
  const fetchAndCache = fetch(request).then(response => {
    if (response.ok) {
      cache.put(request, response.clone());
      // 限制瓦片缓存数量，防止无限增长
      trimCache(TILE_CACHE, 500);
    }
    return response;
  }).catch(() => null);

  return cached || fetchAndCache || new Response('', { status: 503 });
}

/** 清理超出数量的缓存（FIFO） */
async function trimCache(cacheName, maxItems) {
  const cache = await caches.open(cacheName);
  const keys = await cache.keys();
  if (keys.length > maxItems) {
    await cache.delete(keys[0]);
  }
}
