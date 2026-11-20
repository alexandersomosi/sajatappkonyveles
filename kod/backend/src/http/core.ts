// Hono plumbing: per-request context (request id, client IP + its HMAC, user agent), security
// headers, error mapping to the SPEC §3.5 error shape, and JSON body parsing with zod.
import { randomUUID } from 'node:crypto';
import type { Context, MiddlewareHandler } from 'hono';
import { z } from 'zod';
import type { UserRole } from '../_shared/enums.js';
import type { Deps } from '../deps.js';
import { hmacHex } from '../lib/crypto.js';
import { ApiError, E } from '../lib/errors.js';
import { log, safeErr } from '../log.js';

export interface AuthInfo {
  userId: string;
  role: UserRole;
  sessionId: string;
  email: string;
  displayName: string | null;
  totpEnabled: boolean;
  emailVerified: boolean;
}

export type Env = {
  Variables: {
    requestId: string;
    ip: string;
    ipHmac: string;
    ua: string;
    auth: AuthInfo | null;
    rawBody?: string;
  };
};

export type C = Context<Env>;

function clientIp(c: Context, hops: number): string {
  const xff = c.req.header('x-forwarded-for');
  if (xff && hops > 0) {
    const parts = xff
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    // Caddy sets the header to the remote address of the connection it accepted (last hop).
    const ip = parts[parts.length - 1];
    if (ip) return ip;
  }
  const incoming = (c.env as { incoming?: { socket?: { remoteAddress?: string } } } | undefined)?.incoming;
  return incoming?.socket?.remoteAddress ?? '0.0.0.0';
}

/** IPv4 (also IPv4-mapped) stays whole; an IPv6 address is cut to its /64 prefix. */
export function rateKeyOfIp(ip: string): string {
  const v4 = /^(?:::ffff:)?(\d{1,3}(?:\.\d{1,3}){3})$/i.exec(ip);
  if (v4) return v4[1]!;
  if (!ip.includes(':')) return ip;
  const [head = '', tail = ''] = ip.toLowerCase().split('%')[0]!.split('::');
  const h = head ? head.split(':') : [];
  const t = tail ? tail.split(':') : [];
  const groups = ip.includes('::') ? [...h, ...Array(Math.max(0, 8 - h.length - t.length)).fill('0'), ...t] : h;
  return `${groups.slice(0, 4).map((g) => g.replace(/^0+(?=.)/, '')).join(':')}::/64`;
}

export function requestContext(deps: Deps): MiddlewareHandler<Env> {
  return async (c, next) => {
    const incomingId = c.req.header('x-request-id');
    const requestId = incomingId && /^[A-Za-z0-9._:-]{8,80}$/.test(incomingId) ? incomingId : randomUUID();
    const ip = clientIp(c, deps.cfg.trustProxyHops);
    c.set('requestId', requestId);
    c.set('ip', ip);
    // Rate limits and "known address" checks key on the /64 of an IPv6 address (one subscriber can rotate freely inside it).
    c.set('ipHmac', hmacHex(deps.cfg.auditIpSalt, rateKeyOfIp(ip)).slice(0, 32));
    c.set('ua', (c.req.header('user-agent') ?? '').slice(0, 120));
    c.set('auth', null);
    const started = Date.now();
    await next();
    c.header('X-Request-Id', requestId);
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('Referrer-Policy', 'no-referrer');
    c.header('X-Frame-Options', 'DENY');
    if (!c.res.headers.get('Cache-Control')) c.header('Cache-Control', 'no-store');
    const ms = Date.now() - started;
    if (!deps.cfg.isTest) {
      log().info(
        { rid: requestId, m: c.req.method, p: routePattern(c), s: c.res.status, ms, ipH: c.get('ipHmac').slice(0, 12) },
        'req',
      );
    }
  };
}

/** Logged path without ids, tokens or query strings. */
function routePattern(c: Context): string {
  const p = c.req.routePath || c.req.path;
  return p.replace(/[0-9a-f]{8}-[0-9a-f-]{27}/gi, ':id');
}

export function errorHandler(deps: Deps) {
  return (err: Error, c: Context<Env>) => {
    if (err instanceof ApiError) {
      for (const [k, v] of Object.entries(err.headers ?? {})) c.header(k, v);
      return c.json(err.toJSON(), err.status as 400);
    }
    if (err instanceof z.ZodError) {
      const e = E.validation(zodFields(err));
      return c.json(e.toJSON(), 400);
    }
    if ((err as { status?: number }).status === 413) {
      return c.json(E.tooLarge('Túl nagy a kérés.').toJSON(), 413);
    }
    // Database constraint errors are client conflicts, not crashes (e.g. two parallel sign-ups).
    const sqlState = dbState(err);
    if (sqlState?.code === '23505') {
      const msg = sqlState.constraint?.includes('email') ? 'Ezzel az e-mail-címmel már van fiókod. Lépj be, vagy kérj új jelszót.' : 'Ez már létezik. Frissítsd az oldalt, és próbáld újra.';
      return c.json(E.conflict(msg).toJSON(), 409);
    }
    log().error({ rid: c.get('requestId'), err: safeErr(err, deps.cfg.isTest) }, 'unhandled');
    return c.json(E.internal().toJSON(), 500);
  };
}

function dbState(err: unknown): { code: string; constraint?: string } | null {
  let e: unknown = err;
  for (let i = 0; i < 4 && e && typeof e === 'object'; i++) {
    const o = e as { code?: unknown; constraint?: unknown; cause?: unknown };
    if (typeof o.code === 'string' && /^[0-9A-Z]{5}$/.test(o.code)) return { code: o.code, ...(typeof o.constraint === 'string' ? { constraint: o.constraint } : {}) };
    e = o.cause;
  }
  return null;
}

const DEFAULT_MSG = /^(Invalid|Too |Expected|Unrecognized|Required|Number must|String must|Array must)/;

function huMessage(issue: z.core.$ZodIssue): string {
  if (issue.message && !DEFAULT_MSG.test(issue.message)) return issue.message;
  switch (issue.code) {
    case 'invalid_type':
      return (issue as { input?: unknown }).input === undefined ? 'Kötelező.' : 'Hibás formátum.';
    case 'too_small':
      return 'Túl rövid vagy túl kicsi.';
    case 'too_big':
      return 'Túl hosszú vagy túl nagy.';
    case 'invalid_format':
      return 'Hibás formátum.';
    case 'invalid_value':
      return 'Nem választható érték.';
    case 'unrecognized_keys':
      return 'Ismeretlen mező.';
    default:
      return 'Hibás érték.';
  }
}

export function zodFields(err: z.ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of err.issues) {
    const key = issue.path.length ? issue.path.join('.') : '_';
    if (!out[key]) out[key] = huMessage(issue);
  }
  return out;
}

const JSON_LIMIT = 1024 * 1024;

/**
 * SPEC §27.11 S3: a JSON body must say so. A form (enctype text/plain) or a no-cors fetch from another site cannot send
 * Content-Type application/json, and with it a cross-site fetch needs a CORS preflight that our API never answers –
 * so other sites cannot sign a visitor in (login CSRF) or make visitors' browsers post to us.
 */
export function assertJsonContentType(c: C, text: string): void {
  if (!text.trim()) return;
  const ct = (c.req.header('content-type') ?? '').toLowerCase();
  if (!ct.startsWith('application/json')) throw E.unsupported('A kérésnek JSON-nak kell lennie (Content-Type: application/json).');
}

export async function readJson<T extends z.ZodType>(c: C, schema: T): Promise<z.infer<T>> {
  const len = Number(c.req.header('content-length') ?? '0');
  if (len > JSON_LIMIT) throw E.tooLarge('Túl nagy a kérés.');
  let raw: unknown = {};
  const text = await c.req.text();
  if (text.length > JSON_LIMIT) throw E.tooLarge('Túl nagy a kérés.');
  assertJsonContentType(c, text);
  if (text.trim()) {
    try {
      raw = JSON.parse(text);
    } catch {
      throw E.validation(undefined, 'A kérés nem érvényes JSON.');
    }
  }
  const r = schema.safeParse(raw);
  if (!r.success) throw E.validation(zodFields(r.error));
  return r.data;
}

export function parseQuery<T extends z.ZodType>(c: C, schema: T): z.infer<T> {
  const r = schema.safeParse(c.req.query());
  if (!r.success) throw E.validation(zodFields(r.error));
  return r.data;
}

export function auth(c: C): AuthInfo {
  const a = c.get('auth');
  if (!a) throw E.unauthenticated();
  return a;
}

export const uuidParam = z.string().uuid({ error: 'Hibás azonosító.' });

export function param(c: C, name: string): string {
  const v = c.req.param(name);
  if (!v || !uuidParam.safeParse(v).success) throw E.notFound();
  return v;
}

/**
 * SPEC §27.11 S3: the cookie-setting /auth/* routes refuse cross-site browser requests. Same-origin pages, our three
 * public origins and (outside production) local dev hosts are allowed; native apps send no Origin at all.
 */
export function sameSiteGuard(deps: Deps): MiddlewareHandler<Env> {
  // SPEC §29.3.4: APP/PANEL/API/LANDING_PUBLIC_URL + EXTRA_PUBLIC_ORIGINS (adozz.hu and the kept sslip hosts).
  const allowed = new Set([deps.cfg.appPublicUrl, deps.cfg.panelPublicUrl, deps.cfg.apiPublicUrl, ...(deps.cfg.publicOrigins ?? [])].map((u) => {
    try {
      return new URL(u).origin;
    } catch {
      return '';
    }
  }));
  return async (c, next) => {
    if (c.req.method !== 'GET' && c.req.method !== 'HEAD' && c.req.method !== 'OPTIONS') {
      if ((c.req.header('sec-fetch-site') ?? '').toLowerCase() === 'cross-site') throw E.forbidden('Ezt a kérést csak a saját oldalunkról lehet elküldeni.');
      const origin = c.req.header('origin');
      if (origin && origin !== 'null') {
        let ok = allowed.has(origin);
        try {
          const o = new URL(origin);
          const host = c.req.header('host');
          if (host && o.host === host) ok = true;
          if (deps.cfg.appEnv !== 'production' && (o.hostname === 'localhost' || o.hostname === '127.0.0.1')) ok = true;
        } catch {
          ok = false;
        }
        if (!ok) throw E.forbidden('Ezt a kérést csak a saját oldalunkról lehet elküldeni.');
      } else if (origin === 'null') throw E.forbidden('Ezt a kérést csak a saját oldalunkról lehet elküldeni.');
    }
    await next();
  };
}
