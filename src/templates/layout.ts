import { themeById } from '../themes';

// Cache-busting for JS/CSS. Changes on server restart (deploy/update).
const ASSET_VER = Date.now().toString(36);

export function escapeHtml(s: string){
  return String(s)
    .replaceAll('&','&amp;')
    .replaceAll('<','&lt;')
    .replaceAll('>','&gt;')
    .replaceAll('"','&quot;')
    .replaceAll("'", '&#039;');
}

export function layout({ title, description, body, themeId, bootstrap }: { title: string; description: string; body: string; themeId?: string; bootstrap?: any }){
  // Basic SSR shell. SPA will takeover.
  const t = themeId ? themeById(themeId) : null;
  const themeStyle = t ? Object.entries(t.colors).map(([k,v]) => `--${k}:${v}`).join(';') : '';

  // Match client-side background presets to avoid “flash” before SPA loads.
  const bgStyle = t
    ? (t.light
        ? `background: radial-gradient(1100px 560px at 20% -10%, rgba(76,111,255,.12), transparent 55%), radial-gradient(900px 520px at 110% 10%, rgba(31,185,129,.12), transparent 60%), var(--bg)`
        : `background: radial-gradient(1200px 600px at 20% -10%, rgba(124,92,255,.22), transparent 55%), radial-gradient(900px 520px at 110% 10%, rgba(46,212,167,.20), transparent 60%), var(--bg)`)
    : '';

  const bodyStyle = [themeStyle, bgStyle].filter(Boolean).join('; ');

  // Safe JSON embedding (prevents </script> injection via \u003c).
  const bootstrapJson = bootstrap ? JSON.stringify(bootstrap).replaceAll('<', '\\u003c') : '';
  const bootstrapScript = bootstrap ? `<script>window.__PARITER_BOOTSTRAP__ = ${bootstrapJson};</script>` : '';

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)}</title>
  <meta name="description" content="${escapeHtml(description)}" />

  <!-- Fonts (optional aesthetic layer) -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,300;0,400;0,600;1,400;1,500&family=Manrope:wght@200;300;400&family=Space+Mono&display=swap" rel="stylesheet">

  <!-- (Платформенное требование) Tailwind CDN подключён, но приложение не зависит от Tailwind. -->
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>

  <link rel="stylesheet" href="/static/css/style.css?v=${ASSET_VER}" />
  <link rel="icon" href="/static/favicon.svg" type="image/svg+xml" />
  <link rel="manifest" href="/static/manifest.webmanifest" />
  <meta name="theme-color" content="#7c5cff" />
</head>
<body style="${bodyStyle}">
  <div id="app">${body}</div>
  <div id="toast" class="toast hidden" role="status" aria-live="polite"></div>

  <noscript>
    <div style="padding:16px; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;">Для работы Pariter нужен JavaScript.</div>
  </noscript>

  ${bootstrapScript}
  <script>
    // PWA: service worker (best-effort)
    (function(){
      try {
        if ('serviceWorker' in navigator) {
          // Register ASAP (do not wait for load). Keep scope '/'
          // so Push works app-wide on Android.
          navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(function(){});
        }
      } catch {}
    })();
  </script>
  <script type="module" src="/static/js/app.js?v=${ASSET_VER}"></script>
</body>
</html>`;
}
