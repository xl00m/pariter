import { openDB, migrate } from './db';
import { handleApi } from './routes/api';
import { renderAppShell } from './routes/pages';
import { meResponse, requireAuth } from './auth';

type Config = {
  port?: number;
  dbPath?: string;
  staticDir?: string;
};

async function readConfig(): Promise<Config> {
  try {
    const f = Bun.file('./config.json');
    if (!(await f.exists())) return {};
    const txt = await f.text();
    const obj = JSON.parse(txt);
    return (obj && typeof obj === 'object') ? obj : {};
  } catch {
    return {};
  }
}

const cfg = await readConfig();

const db = openDB(process.env.PARITER_DB || cfg.dbPath || './pariter.db');
migrate(db);

const staticDir = process.env.PARITER_STATIC || cfg.staticDir || './static';

// Basic security headers (safe defaults). Add HSTS only when running behind HTTPS.
const SECURE = process.env.PARITER_SECURE_COOKIE === '1';
const SECURITY_HEADERS: Record<string,string> = {
  'x-content-type-options': 'nosniff',
  'x-frame-options': 'DENY',
  'referrer-policy': 'no-referrer',
  // Minimal permissions policy (expand if you add capabilities).
  'permissions-policy': 'geolocation=(), microphone=(), camera=()'
};
if (SECURE) SECURITY_HEADERS['strict-transport-security'] = 'max-age=31536000; includeSubDomains';

function withSecurityHeaders(res: Response){
  const h = new Headers(res.headers);
  for (const [k,v] of Object.entries(SECURITY_HEADERS)) {
    if (!h.has(k)) h.set(k, v);
  }
  return new Response(res.body, { status: res.status, headers: h });
}

function contentTypeFor(pathname: string){
  if (pathname.endsWith('.css')) return 'text/css; charset=utf-8';
  if (pathname.endsWith('.js')) return 'text/javascript; charset=utf-8';
  if (pathname.endsWith('.ico')) return 'image/x-icon';
  if (pathname.endsWith('.svg')) return 'image/svg+xml; charset=utf-8';
  if (pathname.endsWith('.png')) return 'image/png';
  if (pathname.endsWith('.jpg') || pathname.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

function safeStaticPath(pathname: string){
  // prevent path traversal
  const rel = pathname.replace(/^\/static\//, '');
  const clean = rel.split('/').filter(p => p && p !== '.' && p !== '..').join('/');
  return staticDir.replace(/\/$/,'') + '/' + clean;
}

async function serveFile(pathname: string){
  const filePath = safeStaticPath(pathname);
  const f = Bun.file(filePath);
  if (!(await f.exists())) return new Response('not found', { status: 404 });
  return new Response(f, {
    headers: {
      'content-type': contentTypeFor(pathname),
      'cache-control': 'public, max-age=86400'
    }
  });
}

function isStatic(pathname: string){
  return pathname.startsWith('/static/') || pathname === '/favicon.ico';
}

const server = Bun.serve({
  port: Number(process.env.PORT || cfg.port || 8080),
  async fetch(req){
    const url = new URL(req.url);
    const path = url.pathname;

    // Static
    if (isStatic(path)) {
      if (path === '/favicon.ico') {
        const ico = Bun.file(staticDir.replace(/\/$/,'') + '/favicon.ico');
        if (await ico.exists()) {
          return withSecurityHeaders(new Response(ico, {
            headers: { 'content-type': 'image/x-icon', 'cache-control': 'public, max-age=86400' }
          }));
        }
        // fallback to svg
        const svg = Bun.file(staticDir.replace(/\/$/,'') + '/favicon.svg');
        if (await svg.exists()) {
          return withSecurityHeaders(new Response(svg, {
            headers: { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'public, max-age=86400' }
          }));
        }
        return withSecurityHeaders(new Response('not found', { status: 404 }));
      }
      return withSecurityHeaders(await serveFile(path));
    }

    // API
    if (path.startsWith('/api/')) {
      if (path === '/api/me' && req.method === 'GET') return withSecurityHeaders(meResponse(db, req));
      return withSecurityHeaders(await handleApi(db, req));
    }

    // Pages: real routes + SPA fallback
    // We always serve the shell for SPA routes.
    let themeId: string | undefined = undefined;
    let authed = false;
    let bootstrap: any = undefined;
    try {
      const { user, team } = requireAuth(db, req);
      themeId = user?.theme || undefined;
      authed = true;

      // Preload team users for immediate header avatars on first paint.
      const users = db.query(
        'SELECT id, team_id, email, name, login, role, theme, is_admin, created_at FROM users WHERE team_id = ? ORDER BY datetime(created_at) ASC'
      ).all(user.team_id) as any[];

      const safeUser = { ...user };
      delete (safeUser as any).password_hash;
      bootstrap = { user: safeUser, team, teamUsers: users };
    } catch {}

    // If already authenticated, avoid showing auth/landing pages.
    if (authed && (path === '/' || path === '/login' || path === '/register' || path.startsWith('/join/'))) {
      return withSecurityHeaders(Response.redirect('/path', 302));
    }

    const allowed = new Set(['/', '/login', '/register', '/path', '/settings', '/invite']);
    if (allowed.has(path) || path.startsWith('/join/')) {
      return withSecurityHeaders(new Response(renderAppShell(path, themeId, bootstrap), {
        headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
      }));
    }

    // Fallback to SPA shell
    return withSecurityHeaders(new Response(renderAppShell(path, themeId, bootstrap), {
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' }
    }));
  }
});

console.log(`PARITER running on http://localhost:${server.port}`);
