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
// Important: even if payload is missing (event.data == null) or can't be parsed,
// we still show a generic notification. Otherwise it looks like "push doesn't arrive".
self.addEventListener('push', (event) => {
  event.waitUntil((async ()=>{
    try {
      // Messenger-like: keep one “inbox” notification updated.
      // If user clears it manually, next push will re-create it.
      const inboxTag = 'pariter_inbox';

      // 1) Try to enrich tickle-push with a real preview by fetching from backend.
      // This avoids encrypted payload fragility and behaves like messengers.
      let title = 'Pariter';
      let body = 'Новый шаг. Открой Pariter, чтобы посмотреть.';
      let url = '/path';

      try {
        const lastKey = String(await idbGet('lastInboxKey') || '').trim();
        let afterDate = '';
        let afterId = 0;
        if (lastKey && lastKey.includes('#')) {
          const [d, i] = lastKey.split('#');
          afterDate = String(d || '').trim();
          afterId = Number(i || '0');
        }

        const qp = new URLSearchParams();
        if (afterDate && afterId) {
          qp.set('afterDate', afterDate);
          qp.set('afterId', String(afterId));
        }
        qp.set('limit', '1');

        const tok = String(await idbGet('pushToken') || '').trim();
        const headers = tok ? { 'authorization': `Bearer ${tok}` } : undefined;
        const r = await fetch('/api/push/inbox?' + qp.toString(), { cache: 'no-store', headers }).catch(()=>null);
        if (r && r.ok) {
          const j = await r.json().catch(()=>null);
          const newest = (j && typeof j === 'object' && Array.isArray(j.entries) && j.entries[0]) ? j.entries[0] : null;
          const cnt = (j && typeof j === 'object' && 'count' in j) ? Number(j.count || 0) : 0;

          if (newest) {
            const authorName = String(newest?.author?.name || 'Спутник');
            const preview = String(newest?.preview || '').trim();
            title = authorName;
            body = preview ? preview.slice(0, 160) : body;
            url = '/path';

            const nk = `${String(newest.date || '').trim()}#${Number(newest.id || 0)}`;
            if (nk && nk.includes('#')) {
              await idbSet('lastInboxKey', nk);
            }

            // Aggregation hint
            if (cnt > 1) {
              body = body ? `${body} (и еще ${cnt - 1})` : `Новых шагов: ${cnt}`;
            }
          }
        }
      } catch {
        // fallback to generic text below
      }

      // 2) If push payload exists (optional), use it as fallback.
      // This is kept for compatibility, but main path is fetch-based enrichment.
      try {
        let data = null;
        try {
          data = event.data ? event.data.json() : null;
        } catch {
          const t = event.data ? event.data.text() : '';
          data = { type: 'text', text: String(t || '').trim() };
        }

        if (data && typeof data === 'object') {
          if (data.type === 'entry') {
            const authorName = data?.author?.name || 'Спутник';
            const preview = String(data?.preview || '').trim();
            title = authorName;
            body = preview ? preview.slice(0, 160) : body;
          } else if (data.type === 'text' && data.text) {
            title = 'Pariter';
            body = String(data.text).slice(0, 160);
          }
        }
      } catch {}

      // Messenger-like: keep a single pinned inbox notification.
      // Do not spam duplicates: if we receive multiple identical pushes in a short window,
      // ignore the repeats.
      try {
        const now = Date.now();
        const sig = `${title}\n${body}`;
        // @ts-ignore
        const lastAt = Number(self.__pariterLastAt || 0);
        // @ts-ignore
        const lastSig = String(self.__pariterLastSig || '');
        if (sig === lastSig && (now - lastAt) < 6000) {
          return;
        }
        // @ts-ignore
        self.__pariterLastAt = now;
        // @ts-ignore
        self.__pariterLastSig = sig;
      } catch {}

      // Close any old non-inbox notifications so tray doesn't accumulate legacy tags.
      try {
        const notes = await self.registration.getNotifications({});
        for (const n of notes) {
          try {
            if (n?.tag && n.tag !== inboxTag) n.close();
          } catch {}
        }
      } catch {}

      await self.registration.showNotification(title, {
        body,
        tag: inboxTag,
        renotify: true,
        requireInteraction: true,
        icon: '/static/favicon.svg',
        badge: '/static/favicon.svg',
        data: { url },
      });

      // If the app is open, tell the client to refresh UI/badges immediately.
      try {
        const clients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const c of clients) {
          try { c.postMessage({ type: 'push', payload: null }); } catch {}
        }
      } catch {}

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

// --- SW storage (tiny IndexedDB) to persist push token across restarts
const DB_NAME = 'pariter_sw';
const DB_VER = 1;
const STORE = 'kv';

function idbOpen(){
  return new Promise((resolve, reject)=>{
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = ()=>{
      try { req.result.createObjectStore(STORE); } catch {}
    };
    req.onsuccess = ()=> resolve(req.result);
    req.onerror = ()=> reject(req.error);
  });
}
async function idbGet(key){
  try {
    const db = await idbOpen();
    return await new Promise((resolve)=>{
      const tx = db.transaction(STORE, 'readonly');
      const st = tx.objectStore(STORE);
      const r = st.get(key);
      r.onsuccess = ()=> resolve(r.result);
      r.onerror = ()=> resolve(null);
    });
  } catch { return null; }
}
async function idbSet(key, val){
  try {
    const db = await idbOpen();
    await new Promise((resolve)=>{
      const tx = db.transaction(STORE, 'readwrite');
      tx.oncomplete = ()=> resolve(true);
      tx.onerror = ()=> resolve(true);
      tx.objectStore(STORE).put(val, key);
    });
  } catch {}
}

// Receive token from the client
self.addEventListener('message', (event)=>{
  try {
    const data = event?.data;
    if (!data || typeof data !== 'object') return;
    if (data.type !== 'push-token') return;
    const tok = String(data.token || '').trim();
    // allow clearing
    event.waitUntil(idbSet('pushToken', tok));
  } catch {}
});

// Some browsers can rotate/expire push subscriptions after inactivity.
// Resubscribe and update backend without cookies using a persistent token.
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
      const token = String(await idbGet('pushToken') || '').trim();
      if (!token) return;

      // Fetch current VAPID public key (no auth)
      const r = await fetch('/api/push/vapidPublicKey', { cache: 'no-store' }).catch(()=>null);
      const j = r ? await r.json().catch(()=>null) : null;
      const publicKey = j?.publicKey;
      if (!publicKey) return;

      const sub = await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: b64urlToU8(publicKey),
      });

      const sj = sub.toJSON();
      if (!sj?.endpoint || !sj?.keys?.p256dh || !sj?.keys?.auth) return;

      await fetch('/api/push/resubscribe', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ token, endpoint: sj.endpoint, keys: sj.keys })
      }).catch(()=>{});

    } catch {
      // ignore
    }
  })());
});
