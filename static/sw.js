// Pariter Service Worker (minimal PWA support)
// Network-first for navigations, stale-while-revalidate for static.

const VERSION = 'pariter-sw-v2';
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
    try {
      const cache = await caches.open(VERSION);
      await cache.addAll(CORE).catch(()=>{});
    } finally {
      self.skipWaiting();
    }
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

// Push notifications
self.addEventListener('push', (event) => {
  event.waitUntil((async ()=>{
    try {
      let data = null;
      try {
        data = event.data ? event.data.json() : null;
      } catch {
        // Some push services can deliver non-JSON payloads; fallback to text.
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

        // If the app is open, tell the client to refresh UI/badges immediately.
        try {
          const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
          for (const c of clients) {
            try { c.postMessage({ type: 'push', payload: data }); } catch {}
          }
        } catch {}

        return;
      }

      // Fallback: show whatever text we got
      if (data.type === 'text' && data.text) {
        await self.registration.showNotification('Pariter', {
          body: String(data.text).slice(0, 160),
          tag: 'pariter_text',
          renotify: false,
          data: { url: '/path' },
        });
      }
    } catch {
      // ignore
    }
  })());
});

// Notifications: focus/open the app on click.
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

// App-open hygiene: clear existing notifications when the client tells us the app is active.
self.addEventListener('message', (event)=>{
  try {
    const data = event?.data;
    if (!data || typeof data !== 'object') return;
    if (data.type !== 'clear-notifications') return;

    event.waitUntil((async ()=>{
      try {
        const notes = await self.registration.getNotifications({});
        for (const n of notes) {
          try { n.close(); } catch {}
        }
      } catch {}
    })());
  } catch {}
});

// Some browsers can rotate/expire push subscriptions after inactivity.
// Try to resubscribe and re-send the new subscription to the backend automatically.
function b64urlToU8(b64url){
  let s = String(b64url || '').replace(/-/g, '+').replace(/_/g, '/');
  const pad = s.length % 4;
  if (pad) s += '='.repeat(4 - pad);
  const bin = atob(s);
  const u8 = new Uint8Array(bin.length);
  for (let i=0;i<bin.length;i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

self.addEventListener('pushsubscriptionchange', (event)=>{
  event.waitUntil((async ()=>{
    try {
      // Fetch current VAPID public key
      const r = await fetch('/api/push/vapidPublicKey', { cache: 'no-store', credentials: 'include' }).catch(()=>null);
      const j = r ? await r.json().catch(()=>null) : null;
      const publicKey = j?.publicKey;
      if (!publicKey) return;

      const sub = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64urlToU8(publicKey),
      });

      const sj = sub.toJSON();
      if (!sj?.endpoint || !sj?.keys?.p256dh || !sj?.keys?.auth) return;

      await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ endpoint: sj.endpoint, keys: sj.keys })
      }).catch(()=>{});

    } catch {
      // ignore
    }
  })());
});
