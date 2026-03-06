const CACHE = 'fireash-v11';
const ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/logo.jpeg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => {
      return Promise.allSettled(ASSETS.map(a => c.add(a).catch(() => null)));
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  
  // Only intercept our own domain (local static files).
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;

  // ---------------------------------------------------------
  // STRATEGY 1: NETWORK-FIRST for the HTML File
  // Always try to get the absolute newest code from the server.
  // If offline, safely fall back to the cached version.
  // ---------------------------------------------------------
  if (e.request.mode === 'navigate' || e.request.headers.get('accept').includes('text/html')) {
    e.respondWith(
      fetch(e.request).then(res => {
        // If we got a good response, save a fresh copy to the cache
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => {
        // If the user is offline, pull the app from the cache!
        return caches.match(e.request).then(cached => {
          return cached || caches.match('/index.html');
        });
      })
    );
    return;
  }

  // ---------------------------------------------------------
  // STRATEGY 2: CACHE-FIRST for Images & Assets
  // Instantly load the logo and other heavy assets from memory.
  // ---------------------------------------------------------
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      
      return fetch(e.request).then(res => {
        if (!res || res.status !== 200 || res.type !== 'basic') return res;
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone)).catch(() => {});
        return res;
      });
    })
  );
});
