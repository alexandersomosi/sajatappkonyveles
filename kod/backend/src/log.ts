// pino JSON logs with central redaction (SPEC §4.7). Never log bodies, Authorization, cookies,
// e-mail addresses, IPs (use the HMAC), codes, tokens, NAV credentials, SimplePay tokens or
// user-supplied file names. The redaction list is unit-tested (test/log.test.ts).
import { pino, type Logger } from 'pino';

export const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-forwarded-for"]',
  'res.headers["set-cookie"]',
  'headers.authorization',
  'headers.cookie',
  'authorization',
  'cookie',
  'password',
  'newPassword',
  'currentPassword',
  'code',
  'token',
  'tokens',
  'accessToken',
  'refreshToken',
  'mfaToken',
  'idToken',
  'identityToken',
  'secret',
  'signature',
  'signatureKey',
  'exchangeKey',
  'login',
  'email',
  'to',
  'ip',
  'body',
  'fileName',
  'displayName',
  'adoazonositoJel',
  'phone',
  '*.password',
  '*.newPassword',
  '*.code',
  '*.token',
  '*.tokens',
  '*.accessToken',
  '*.refreshToken',
  '*.idToken',
  '*.secret',
  '*.signature',
  '*.signatureKey',
  '*.exchangeKey',
  '*.login',
  '*.email',
  '*.to',
  '*.ip',
  '*.body',
  '*.fileName',
  '*.displayName',
  '*.adoazonositoJel',
  '*.phone',
];

/** pg SQLSTATE etc. of a (possibly wrapped) database error; never the query, params or message. */
function dbInfo(err: unknown): { code?: string; constraint?: string; table?: string } | null {
  let e: unknown = err;
  for (let i = 0; i < 4 && e && typeof e === 'object'; i++) {
    const o = e as { code?: unknown; constraint?: unknown; table?: unknown; cause?: unknown };
    if (typeof o.code === 'string' && /^[0-9A-Z]{5}$/.test(o.code)) {
      return { code: o.code, ...(typeof o.constraint === 'string' ? { constraint: o.constraint } : {}), ...(typeof o.table === 'string' ? { table: o.table } : {}) };
    }
    e = o.cause;
  }
  return null;
}

function isDbError(err: unknown): boolean {
  const e = err as { name?: unknown; message?: unknown } | null;
  if (!e || typeof e !== 'object') return false;
  if (e.name === 'DrizzleQueryError') return true;
  const m = typeof e.message === 'string' ? e.message : '';
  return /^Failed query:|\bparams:/m.test(m) || dbInfo(err) !== null;
}

/** Removes e-mail addresses, long digit runs (tax ids, phone numbers, card data) and JWT/tokens. */
export function scrubText(s: string): string {
  return s
    .replace(/[^\s@<>"'(),;:]+@[^\s@<>"'(),;:]+/g, '[e-mail]')
    .replace(/\$argon2[^\s"',]*/g, '[hash]')
    .replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]*/g, '[token]')
    .replace(/\+?\d[\d \-]{6,}\d/g, '[szám]');
}

/**
 * The ONLY way errors are logged (SPEC §4.7): name + pg SQLSTATE/constraint/table for database
 * errors (a DrizzleQueryError's message contains the SQL and every bound value – e-mails, names,
 * password hashes – so it is never logged), a scrubbed, shortened message for everything else.
 */
export function safeErr(err: unknown, withStack = false): Record<string, unknown> {
  if (!err || typeof err !== 'object') return { message: scrubText(String(err)).slice(0, 200) };
  const e = err as Error;
  if (isDbError(err)) return { name: e.name === 'Error' ? 'DatabaseError' : e.name, db: dbInfo(err) };
  return { name: e.name, message: scrubText(String(e.message ?? '')).slice(0, 300), ...(withStack && e.stack ? { stack: scrubText(e.stack).slice(0, 2000) } : {}) };
}

export function createLogger(level: string, destination?: { write(s: string): void }): Logger {
  const opts = {
    level,
    base: { svc: 'kezjegy' },
    // Safety net: a raw Error passed as `err` is reduced the same way.
    serializers: { err: (e: unknown) => (e instanceof Error ? safeErr(e) : e) },
    redact: { paths: REDACT_PATHS, censor: '[rejtve]' },
    timestamp: pino.stdTimeFunctions.isoTime,
    formatters: { level: (label: string) => ({ level: label }) },
  };
  return destination ? pino(opts, destination as never) : pino(opts);
}

let current: Logger = createLogger(process.env.LOG_LEVEL || 'info');

export function setLogger(l: Logger): void {
  current = l;
}

export function log(): Logger {
  return current;
}
