// Pariter Service Worker (minimal PWA support)
// Network-first for navigations, stale-while-revalidate for static.

const VERSION = 'pariter-sw-v1';
const CORE = [
  '/',
  '/path',
  '/login',
  '/register',
  '/invite',
  '/settings',
  '/static/css/style.css',
  '/static/js/app.js',
  '/static/favicon.svg',
  '/static/manifest.webmanifest',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async ()=>{
    const cache = await caches.open(VERSION);
    await cache.addAll(CORE).catch(()=>{});
    self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async ()=>{
    const keys = await caches.keys();
    await Promise.all(keys.map(k => (k === VERSION ? null : caches.delete(k))));
    await self.clients.claim();
  })());
});

function isNavigationRequest(req){
  return req.mode === 'navigate' || (req.headers.get('accept') || '').includes('text/html');
}

function isStaticRequest(url){
  return url.pathname.startsWith('/static/');
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Only same-origin.
  if (url.origin !== self.location.origin) return;

  // Never cache API.
  if (url.pathname.startsWith('/api/')) {
    return; // default network
  }

  // Navigations: network-first, fallback to cached /path shell.
  if (isNavigationRequest(req)) {
    event.respondWith((async ()=>{
      try {
        const fresh = await fetch(req);
        // best-effort update cached shell
        const cache = await caches.open(VERSION);
        cache.put(req, fresh.clone()).catch(()=>{});
        return fresh;
      } catch {
        const cache = await caches.open(VERSION);
        return (await cache.match(req)) || (await cache.match('/path')) || new Response('offline', { status: 503 });
      }
    })());
    return;
  }

  // Static: stale-while-revalidate
  if (isStaticRequest(url)) {
    event.respondWith((async ()=>{
      const cache = await caches.open(VERSION);
      const cached = await cache.match(req);
      const p = fetch(req).then(res => {
        if (res && res.ok) cache.put(req, res.clone()).catch(()=>{});
        return res;
      }).catch(()=>null);
      return cached || (await p) || new Response('offline', { status: 503 });
    })());
  }
});
