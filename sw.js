const VERSION = 'pariter-sw-v1';
const CORE = [
  '/',
  '/path',
  '/login',
  '/register',
  '/invite',
  '/settings',
  '/sw.js',
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
  return url.pathname.startsWith('/static/') || url.pathname === '/sw.js';
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith('/api/')) {
    return;
  }

  if (isNavigationRequest(req)) {
    event.respondWith((async ()=>{
      try {
        const fresh = await fetch(req);
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

self.addEventListener('push', (event) => {
  event.waitUntil((async ()=>{
    try {
      let data = null;
      try {
        data = event.data ? event.data.json() : null;
      } catch {
        const t = event.data ? event.data.text() : '';
        data = { type: 'text', text: String(t || '').trim() };
      }

      if (!data || typeof data !== 'object') return;

      if (data.type === 'entry') {
        const authorName = data?.author?.name || 'Спутник';
        const preview = String(data?.preview || '').trim();
        const title = `Новый шаг: ${authorName}`;
        const body = preview ? preview.slice(0, 160) : 'Открой Pariter, чтобы посмотреть.';
        const tag = data?.entry?.id ? `pariter_entry_${data.entry.id}` : 'pariter_entry';

        await self.registration.showNotification(title, {
          body,
          tag,
          renotify: false,
          data: { url: '/path' },
        });
        return;
      }

      if (data.type === 'text' && data.text) {
        await self.registration.showNotification('Pariter', {
          body: String(data.text).slice(0, 160),
          tag: 'pariter_text',
          renotify: false,
          data: { url: '/path' },
        });
      }
    } catch {
    }
  })());
});

self.addEventListener('notificationclick', (event) => {
  try { event.notification.close(); } catch {}
  const url = (event.notification && event.notification.data && event.notification.data.url) ? event.notification.data.url : '/path';
  event.waitUntil((async ()=>{
    try {
      const all = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      for (const c of all) {
        try {
          if ('focus' in c) {
            await c.focus();
            if ('navigate' in c) await c.navigate(url);
            return;
          }
        } catch {}
      }
      if (self.clients.openWindow) await self.clients.openWindow(url);
    } catch {}
  })());
});
