export function nowISO(){ return new Date().toISOString(); }

export function todayYMD(){
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,'0');
  const day = String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

export function json(data: unknown, status=200, headers: HeadersInit = {}){
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      ...headers,
    }
  });
}

export function error(msg: string, status=400){
  return json({ error: msg }, status);
}

export async function readJson<T=any>(req: Request): Promise<T>{
  try { return await req.json(); } catch { return {} as any; }
}

export function uuidv4(){
  const c = globalThis.crypto;
  if (c?.randomUUID) return c.randomUUID();
  const b = crypto.getRandomValues(new Uint8Array(16));
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const hex = Array.from(b).map(x=>x.toString(16).padStart(2,'0')).join('');
  return hex.slice(0,8)+'-'+hex.slice(8,12)+'-'+hex.slice(12,16)+'-'+hex.slice(16,20)+'-'+hex.slice(20);
}

export function parseCookies(cookieHeader: string | null | undefined): Record<string,string> {
  const out: Record<string,string> = {};
  const s = cookieHeader || '';
  s.split(';').forEach(part => {
    const i = part.indexOf('=');
    if (i === -1) return;
    const k = part.slice(0,i).trim();
    const v = part.slice(i+1).trim();
    if (!k) return;
    out[k] = decodeURIComponent(v);
  });
  return out;
}

export function setCookie(name: string, value: string, opts: {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: 'Strict' | 'Lax' | 'None';
  path?: string;
  maxAgeSec?: number;
} = {}){
  const parts: string[] = [];
  parts.push(`${name}=${encodeURIComponent(value)}`);
  parts.push(`Path=${opts.path || '/'}`);
  if (opts.maxAgeSec != null) parts.push(`Max-Age=${Math.floor(opts.maxAgeSec)}`);
  if (opts.httpOnly) parts.push('HttpOnly');
  if (opts.secure) parts.push('Secure');
  if (opts.sameSite) parts.push(`SameSite=${opts.sameSite}`);
  return parts.join('; ');
}

export function sanitizeLogin(login: unknown){
  return String(login || '').trim().toLowerCase();
}

export function validateLogin(login: string){
  const l = sanitizeLogin(login);
  return /^[a-z0-9_\-.]{3,32}$/.test(l);
}

export function validatePassword(p: unknown){
  return typeof p === 'string' && p.length >= 6;
}

export function validateEmail(e: unknown){
  const s = String(e || '').trim();
  return /^\S+@\S+\.\S+$/.test(s);
}

export function randomInviteCode(){
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const r = crypto.getRandomValues(new Uint8Array(8));
  let out = '';
  for (let i=0;i<8;i++) out += chars[r[i] % chars.length];
  return out;
}
