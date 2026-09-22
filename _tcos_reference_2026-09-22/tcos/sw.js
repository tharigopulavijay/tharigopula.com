/* =========================================================================
   The service worker, and what it deliberately refuses to do.

   A doctor asked to install TCOS on his phone. A home-screen app needs a
   service worker, and a service worker on a CLINICAL system is a loaded
   gun: it sits between the app and the network and can serve whatever it
   remembers. Get it wrong and a doctor reads yesterday's prescription,
   yesterday's allergy list, or yesterday's stock count, with nothing on
   screen to say the page is stale.

   SO THIS ONE CACHES ALMOST NOTHING, ON PURPOSE.

     Cached       files whose NAME contains their own content hash -
                  js/consult.ae2afe2621.js, css/tcos.<hash>.css - plus the
                  icons. A hashed file cannot go stale: if the contents
                  change, the name changes, and the old name is simply
                  never requested again. This is the only category where
                  cache-first is not a guess.

     Never cached EVERY page, every API call, and anything with a query
                  string. Patients, prescriptions, stock, the diary - all
                  of it goes to the network every time, and if the network
                  is down the request fails honestly.

   That means TCOS does not work offline, and that is the right trade for
   now. A clinical record that loads but might be a day old is worse than
   one that says it cannot reach the server - the second is a problem the
   doctor can see, and the first is one she cannot.

   WHAT IT BUYS. The app opens from the home screen without a browser bar,
   its shell loads instantly off the device instead of over 4G, and Android
   will offer to install it.
   ========================================================================= */

/* Bump this to evict everything. Old caches are deleted on activate, so a
   bad release is one deploy away from being gone rather than living in
   every doctor's phone until she clears her browser data. */
const CACHE = 'tcos-static-v1';

/* A fingerprinted filename: name.<8 or more hex>.ext. build-public.js is
   what produces these, and only these are safe to keep. */
const FINGERPRINTED = /\.[0-9a-f]{8,}\.(js|css)$/i;
const ICON = /^\/assets\/app\/icon-\d+\.png$/;

self.addEventListener('install', event => {
  /* Nothing is precached. A precache list is a list to get wrong, and the
     shell is fetched on first load anyway. */
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const names = await caches.keys();
    await Promise.all(names
      .filter(name => name.startsWith('tcos-static-') && name !== CACHE)
      .map(name => caches.delete(name)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', event => {
  const request = event.request;

  /* GET only. A POST that went to a cache would be a prescription that was
     never issued. */
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  /* Same origin only: the API lives on a different host and must never be
     touched by this. */
  if (url.origin !== self.location.origin) return;

  /* A query string means the answer depends on something other than the
     path, so the path is not a safe key. */
  if (url.search) return;

  const keepable = FINGERPRINTED.test(url.pathname) || ICON.test(url.pathname);
  if (!keepable) return;   /* everything else: straight to the network */

  event.respondWith((async () => {
    const cached = await caches.match(request);
    if (cached) return cached;

    const response = await fetch(request);
    /* Only a clean 200 is worth keeping. Caching a 404 or a redirect under
       a hashed name would pin that failure until the cache is bumped. */
    if (response && response.status === 200 && response.type === 'basic') {
      const cache = await caches.open(CACHE);
      cache.put(request, response.clone());
    }
    return response;
  })());
});
