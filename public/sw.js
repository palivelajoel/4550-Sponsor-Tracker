const CACHE = 'team4550-v3';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

function cacheBestEffort(request, response) {
  caches.open(CACHE)
    .then(cache => cache.put(request, response).catch(() => {}))
    .catch(() => {});
}

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Navigations — Network always (never cache HTML)
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request));
    return;
  }

  // Only cacheable methods use the cache; POST/PUT/DELETE (uploads, API calls)
  // always hit the network and are never stored.
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    event.respondWith(fetch(request));
    return;
  }

  // Vite hashed assets — Cache first with hash-based immutability
  if (/\/assets\/.*\.[a-f0-9]{8}\./.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(cached => {
        if (cached) return cached;
        return fetch(request).then(res => {
          try { cacheBestEffort(request, res.clone()); } catch {}
          return res;
        });
      })
    );
    return;
  }

  // Everything else — Network first
  event.respondWith(
    fetch(request).then(res => {
      try { cacheBestEffort(request, res.clone()); } catch {}
      return res;
    }).catch(() => caches.match(request))
  );
});