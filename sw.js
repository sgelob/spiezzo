/* SPIEZZO service worker — app shell precache + runtime font cache */
const VERSION = 'spiezzo-v3';
const SHELL = [
  './',
  'index.html',
  'css/app.css',
  'js/i18n.js',
  'js/store.js',
  'js/program.js',
  'js/game.js',
  'js/ui.js',
  'data/exercises.js',
  'manifest.webmanifest',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/maskable-512.png',
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(VERSION).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== VERSION && k !== 'fonts'; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (e) {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;

  // Google Fonts: stale-while-revalidate into a persistent cache
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    e.respondWith(
      caches.open('fonts').then(function (c) {
        return c.match(e.request).then(function (hit) {
          const net = fetch(e.request).then(function (res) {
            if (res.ok) c.put(e.request, res.clone());
            return res;
          }).catch(function () { return hit; });
          return hit || net;
        });
      })
    );
    return;
  }

  // same-origin: cache-first, fall back to network (and cache it)
  if (url.origin === location.origin) {
    e.respondWith(
      caches.match(e.request).then(function (hit) {
        return hit || fetch(e.request).then(function (res) {
          if (res.ok) {
            const copy = res.clone();
            caches.open(VERSION).then(function (c) { c.put(e.request, copy); });
          }
          return res;
        });
      })
    );
  }
});
