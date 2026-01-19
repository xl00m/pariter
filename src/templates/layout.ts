import { themeById } from '../themes';

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

  <!-- (Платформенное требование) Tailwind CDN подключён, но приложение не зависит от Tailwind. -->
  <script src="https://cdn.jsdelivr.net/npm/@tailwindcss/browser@4"></script>

  <link rel="stylesheet" href="/static/css/style.css" />
  <link rel="icon" href="/static/favicon.svg" type="image/svg+xml" />
</head>
<body style="${bodyStyle}">
  <div id="app">${body}</div>
  <div id="toast" class="toast hidden" role="status" aria-live="polite"></div>

  <noscript>
    <div style="padding:16px; font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial;">Для работы Pariter нужен JavaScript.</div>
  </noscript>

  ${bootstrapScript}
  <script type="module" src="/static/js/app.js"></script>
</body>
</html>`;
}
