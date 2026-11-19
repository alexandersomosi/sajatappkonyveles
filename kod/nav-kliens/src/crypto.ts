// Request authentication values (NAV Online Számla interface spec 3.0, ch. 1.3–1.5).
// passwordHash = UPPER(SHA-512(password)); requestSignature for query operations =
// UPPER(SHA3-512(requestId + yyyyMMddHHmmss(UTC timestamp) + signatureKey)).
// SHA3-512 comes from js-sha3 (SPEC §3.3: do not rely on OpenSSL having sha3-512).
import { createHash, randomBytes } from 'node:crypto';
import jsSha3 from 'js-sha3';

const { sha3_512 } = jsSha3;
const encoder = new TextEncoder();

/** UPPER-case hex SHA-512 of the technical user's password. */
export function passwordHash(password: string): string {
  return createHash('sha512').update(password, 'utf8').digest('hex').toUpperCase();
}

const TIMESTAMP_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?Z$/;

/** "2026-11-17T05:30:00.000Z" → "20261117053000" (the mask the signature uses). */
export function signatureTimestamp(timestampIso: string): string {
  const m = TIMESTAMP_RE.exec(timestampIso);
  if (!m) throw new TypeError('timestamp must be UTC ISO-8601 like 2026-11-17T05:30:00.000Z');
  return `${m[1]}${m[2]}${m[3]}${m[4]}${m[5]}${m[6]}`;
}

/** UPPER-case hex SHA3-512 "partial authentication" signature used by every query operation. */
export function requestSignature(requestId: string, timestampIso: string, signatureKey: string): string {
  return sha3_512(encoder.encode(requestId + signatureTimestamp(timestampIso) + signatureKey)).toUpperCase();
}

/** UTC timestamp in the format NAV expects (millisecond precision, "Z"). */
export function navTimestamp(d: Date): string {
  return d.toISOString();
}

const B36 = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function randomBase36(len: number): string {
  let out = '';
  while (out.length < len) {
    for (const b of randomBytes(len * 2)) {
      if (b < 252) out += B36[b % 36]; // 252 = 7·36 → unbiased
      if (out.length === len) break;
    }
  }
  return out;
}

export const REQUEST_ID_RE = /^[+a-zA-Z0-9_]{1,30}$/;

/** "KJ" + 9 chars base36 time + 17 random base36 chars = 28 chars, matches [+a-zA-Z0-9_]{1,30}. */
export function newRequestId(nowMs: number = Date.now()): string {
  const time = nowMs.toString(36).toUpperCase().padStart(9, '0').slice(-9);
  return `KJ${time}${randomBase36(17)}`;
}
