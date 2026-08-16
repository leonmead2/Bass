/* Offline support without stale pages.
   HTML always comes from the network, bypassing the HTTP cache; the cached
   copy is only a fallback for when there is genuinely no connection.
   Images stay cache-first since they rarely change. */
const CACHE = 'bass-tools-v3';
const ASSETS = ['./icon-book.png', './icon-fretboard.png'];

self.addEventListener('install', function (e) {
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      return Promise.all(ASSETS.map(function (u) {
        return c.add(u).catch(function () {});
      }));
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () { return self.clients.claim(); })
  );
});

function isPage(req) {
  return req.mode === 'navigate' ||
         (req.headers.get('accept') || '').indexOf('text/html') >= 0;
}

self.addEventListener('fetch', function (e) {
  const req = e.request;
  if (req.method !== 'GET') return;

  if (isPage(req)) {
    e.respondWith(
      fetch(req, { cache: 'no-store' }).then(function (res) {
        const copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy).catch(function () {}); });
        return res;
      }).catch(function () {
        return caches.match(req).then(function (hit) {
          return hit || new Response('Offline and no cached copy of this page.',
                                     { headers: { 'Content-Type': 'text/plain' } });
        });
      })
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(function (hit) {
      return hit || fetch(req).then(function (res) {
        const copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy).catch(function () {}); });
        return res;
      });
    })
  );
});
