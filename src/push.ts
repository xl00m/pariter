import { nowISO } from './utils';

const VAPID_FILE = './vapid.json';

type VapidFile = {
  created_at: string;
  publicJwk: JsonWebKey;
  privateJwk: JsonWebKey;
  publicKeyB64Url: string;
};

let _vapidCache: {
  publicKeyB64Url: string;
  publicJwk: JsonWebKey;
  privateJwk: JsonWebKey;
  privateKey: CryptoKey;
} | null = null;

function u8(a: ArrayBuffer | Uint8Array): Uint8Array { 
  return a instanceof Uint8Array ? a : new Uint8Array(a); 
}

function concatU8(...parts: Uint8Array[]): Uint8Array {
  const len = parts.reduce((s,p) => s + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { 
    out.set(p, o); 
    o += p.length; 
  }
  return out;
}

function utf8(s: string): Uint8Array { 
  return new TextEncoder().encode(s); 
}

function b64urlEncode(bytes: Uint8Array): string {
  const b64 = Buffer.from(bytes).toString('base64');
  return b64.replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function b64urlDecode(s: string): Uint8Array {
  let t = String(s || '').replaceAll('-', '+').replaceAll('_', '/');
  const pad = t.length % 4;
  if (pad) t += '='.repeat(4 - pad);
  return new Uint8Array(Buffer.from(t, 'base64'));
}

function b64DecodeFlex(s: string): Uint8Array {
  const str = String(s || '').trim();
  if (!str) return new Uint8Array();
  if (str.includes('-') || str.includes('_')) return b64urlDecode(str);
  return new Uint8Array(Buffer.from(str, 'base64'));
}

async function hmacSha256(key: Uint8Array, data: Uint8Array): Promise<Uint8Array> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', k, data);
  return new Uint8Array(sig);
}

async function hkdfExtract(salt: Uint8Array, ikm: Uint8Array): Promise<Uint8Array> {
  const s = salt && salt.length ? salt : new Uint8Array(32);
  return hmacSha256(s, ikm);
}

async function hkdfExpand(prk: Uint8Array, info: Uint8Array, len: number): Promise<Uint8Array> {
  let t = new Uint8Array(0);
  const okm: Uint8Array[] = [];
  let curLen = 0;
  let i = 1;
  while (curLen < len) {
    const input = concatU8(t, info, new Uint8Array([i]));
    t = await hmacSha256(prk, input);
    okm.push(t);
    curLen += t.length;
    i++;
    if (i > 255) throw new Error('HKDF too long');
  }
  return concatU8(...okm).slice(0, len);
}

function derToJose(derSig: Uint8Array): Uint8Array {
  let p = 0;
  if (derSig[p++] !== 0x30) throw new Error('Bad DER signature');
  const seqLen = derSig[p++];
  if (seqLen + 2 !== derSig.length && seqLen + 2 !== derSig.length) {
  }
  if (derSig[p++] !== 0x02) throw new Error('Bad DER signature');
  const rLen = derSig[p++];
  let r = derSig.slice(p, p + rLen); p += rLen;
  if (derSig[p++] !== 0x02) throw new Error('Bad DER signature');
  const sLen = derSig[p++];
  let s = derSig.slice(p, p + sLen);

  while (r.length > 0 && r[0] === 0) r = r.slice(1);
  while (s.length > 0 && s[0] === 0) s = s.slice(1);

  const rOut = new Uint8Array(32);
  const sOut = new Uint8Array(32);
  if (r.length > 32 || s.length > 32) throw new Error('Bad signature length');
  rOut.set(r, 32 - r.length);
  sOut.set(s, 32 - s.length);

  return concatU8(rOut, sOut);
}

function endpointOrigin(endpoint: string): string {
  const u = new URL(endpoint);
  return `${u.protocol}//${u.host}`;
}

async function fetchWithTimeout(url: string, init: RequestInit, ms = 12000): Promise<Response> {
  const ctrl = new AbortController();
  const t = setTimeout(() => { try { ctrl.abort(); } catch {} }, ms);
  try {
    return await fetch(url, { ...init, signal: ctrl.signal });
  } finally {
    try { clearTimeout(t); } catch {}
  }
}

async function ensureVapid(): Promise<{
  publicKeyB64Url: string;
  publicJwk: JsonWebKey;
  privateJwk: JsonWebKey;
  privateKey: CryptoKey;
}> {
  if (_vapidCache) return _vapidCache;

  let vf: VapidFile | null = null;
  try {
    if (globalThis.Bun?.file) {
      const f = Bun.file(VAPID_FILE);
      if (await f.exists()) {
        const txt = await f.text();
        vf = JSON.parse(txt);
      }
    } else {
      const fs = await import('node:fs/promises');
      const txt = await fs.readFile(VAPID_FILE, 'utf8');
      vf = JSON.parse(txt);
    }
  } catch {
    vf = null;
  }

  if (!vf?.privateJwk || !vf?.publicJwk || !vf?.publicKeyB64Url) {
    const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
    const privateJwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
    const publicJwk = await crypto.subtle.exportKey('jwk', pair.publicKey);

    const x = b64urlDecode(String(publicJwk.x || ''));
    const y = b64urlDecode(String(publicJwk.y || ''));
    const rawPub = concatU8(new Uint8Array([0x04]), x, y);
    const publicKeyB64Url = b64urlEncode(rawPub);

    vf = {
      created_at: nowISO(),
      publicJwk,
      privateJwk,
      publicKeyB64Url,
    };

    try {
      if (globalThis.Bun?.write) {
        await Bun.write(VAPID_FILE, JSON.stringify(vf, null, 2));
      } else {
        const fs = await import('node:fs/promises');
        await fs.writeFile(VAPID_FILE, JSON.stringify(vf, null, 2), 'utf8');
      }
    } catch {
    }
  }

  const privateKey = await crypto.subtle.importKey('jwk', vf.privateJwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign']);
  _vapidCache = {
    publicKeyB64Url: vf.publicKeyB64Url,
    publicJwk: vf.publicJwk,
    privateJwk: vf.privateJwk,
    privateKey,
  };
  return _vapidCache;
}

export async function getVapidPublicKeyB64Url(): Promise<string> {
  const v = await ensureVapid();
  return v.publicKeyB64Url;
}

function ecdsaSigToJose(sig: Uint8Array): Uint8Array {
  if (sig.length === 64) return sig;
  if (sig.length > 8 && sig[0] === 0x30) return derToJose(sig);
  throw new Error('Bad ECDSA signature');
}

async function makeVapidJwt(endpoint: string, subject: string): Promise<{ jwt: string; publicKeyB64Url: string }> {
  const v = await ensureVapid();
  const header = { typ: 'JWT', alg: 'ES256' };
  const exp = Math.floor(Date.now() / 1000) + 12 * 60 * 60;
  const payload = { aud: endpointOrigin(endpoint), exp, sub: subject };

  const enc = (obj: any) => b64urlEncode(utf8(JSON.stringify(obj)));
  const toSign = `${enc(header)}.${enc(payload)}`;

  const sigAny = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, v.privateKey, utf8(toSign)));
  const sigJose = ecdsaSigToJose(sigAny);
  const jwt = `${toSign}.${b64urlEncode(sigJose)}`;

  return { jwt, publicKeyB64Url: v.publicKeyB64Url };
}

async function encryptWebPushPayload(
  payload: string, 
  clientPublicKey: Uint8Array, 
  clientAuthSecret: Uint8Array
): Promise<{
  salt: Uint8Array;
  serverPublicRaw: Uint8Array;
  ciphertext: Uint8Array;
}> {
  const server = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
  const serverPublicRaw = new Uint8Array(await crypto.subtle.exportKey('raw', server.publicKey));

  const clientPubKey = await crypto.subtle.importKey('raw', clientPublicKey, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: clientPubKey }, server.privateKey, 256));

  const salt = crypto.getRandomValues(new Uint8Array(16));

  const prkKey = await hkdfExtract(clientAuthSecret, shared);

  const info = concatU8(utf8('WebPush: info\0'), clientPublicKey, serverPublicRaw);
  const ikm = await hkdfExpand(prkKey, info, 32);

  const prk = await hkdfExtract(salt, ikm);

  const cek = await hkdfExpand(prk, utf8('Content-Encoding: aes128gcm\0'), 16);
  const nonce = await hkdfExpand(prk, utf8('Content-Encoding: nonce\0'), 12);

  const pt = concatU8(utf8(payload), new Uint8Array([0x02]));

  const key = await crypto.subtle.importKey('raw', cek, { name: 'AES-GCM' }, false, ['encrypt']);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, key, pt);

  return {
    salt,
    serverPublicRaw,
    ciphertext: new Uint8Array(ct),
  };
}

export type PushSubscriptionRecord = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export async function sendWebPush({ subscription, payloadJson, subject }: {
  subscription: PushSubscriptionRecord;
  payloadJson: any | null;
  subject: string;
}): Promise<Response> {
  const endpoint = String(subscription.endpoint || '').trim();
  if (!endpoint) throw new Error('No endpoint');

  const { jwt, publicKeyB64Url } = await makeVapidJwt(endpoint, subject);

  const baseHeaders: Record<string, string> = {
    'TTL': '86400',
    'Authorization': `vapid t=${jwt}, k=${publicKeyB64Url}`,
    'Urgency': 'high',
  };

  if (payloadJson == null) {
    const headers: Record<string, string> = {
      ...baseHeaders,
      'Content-Length': '0',
      'Crypto-Key': `p256ecdsa=${publicKeyB64Url}`,
    };
    return await fetchWithTimeout(endpoint, { method: 'POST', headers }, 12000);
  }

  const clientPublicKey = b64DecodeFlex(subscription.p256dh);
  const clientAuthSecret = b64DecodeFlex(subscription.auth);
  if (clientPublicKey.length < 10 || clientAuthSecret.length < 8) throw new Error('Bad subscription keys');

  const payload = JSON.stringify(payloadJson);
  const { salt, serverPublicRaw, ciphertext } = await encryptWebPushPayload(payload, clientPublicKey, clientAuthSecret);

  const headers: Record<string, string> = {
    ...baseHeaders,
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    'Encryption': `salt=${b64urlEncode(salt)}`,
    'Crypto-Key': `dh=${b64urlEncode(serverPublicRaw)}; p256ecdsa=${publicKeyB64Url}`,
  };

  return await fetchWithTimeout(endpoint, { method: 'POST', headers, body: ciphertext }, 12000);
}
