const CACHE = 'team4550-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Navigations — Network always (never cache HTML)
  if (request.mode === 'navigate') {
    event.respondWith(fetch(request));
    return;
  }

  // Vite hashed assets — Cache first with hash-based immutability
  if (/\/assets\/.*\.[a-f0-9]{8}\./.test(url.pathname)) {
    event.respondWith(
      caches.match(request).then(cached => cached || fetch(request).then(res => {
        const copy = res.clone();
        caches.open(CACHE).then(cache => cache.put(request, copy));
        return res;
      }))
    );
    return;
  }

  // Everything else — Network first
  event.respondWith(
    fetch(request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(cache => cache.put(request, copy));
      return res;
    }).catch(() => caches.match(request))
  );
});
