// RFC 6238 TOTP (HMAC-SHA1, 6 digits, 30 s, ±1 step) and RFC 4648 base32. Tested with the RFC
// test vectors (test/totp.test.ts).
import { createHmac, randomBytes } from 'node:crypto';

const ALPH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = '';
  for (const b of buf) {
    value = (value << 8) | b;
    bits += 8;
    while (bits >= 5) {
      out += ALPH[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPH[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[\s=-]/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPH.indexOf(ch);
    if (idx < 0) throw new Error('invalid base32');
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export function hotp(secret: Buffer, counter: number, digits = 6, algo: 'sha1' | 'sha256' | 'sha512' = 'sha1'): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac(algo, secret).update(msg).digest();
  const off = h[h.length - 1]! & 0x0f;
  const bin = ((h[off]! & 0x7f) << 24) | (h[off + 1]! << 16) | (h[off + 2]! << 8) | h[off + 3]!;
  return String(bin % 10 ** digits).padStart(digits, '0');
}

export function totp(secret: Buffer, timeMs: number, opts: { digits?: number; step?: number; algo?: 'sha1' | 'sha256' | 'sha512' } = {}): string {
  const step = opts.step ?? 30;
  return hotp(secret, Math.floor(timeMs / 1000 / step), opts.digits ?? 6, opts.algo ?? 'sha1');
}

/** Returns the matched time step (for replay protection) or null. */
export function verifyTotp(secret: Buffer, code: string, timeMs: number, window = 1): number | null {
  if (!/^\d{6}$/.test(code)) return null;
  const counter = Math.floor(timeMs / 30_000);
  for (let w = -window; w <= window; w++) {
    if (hotp(secret, counter + w) === code) return counter + w;
  }
  return null;
}

export function newTotpSecret(): string {
  return base32Encode(randomBytes(20));
}

export function otpauthUrl(secretB32: string, account: string, issuer: string): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  return `otpauth://totp/${label}?secret=${secretB32}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;
}

/** 10 recovery codes like "k7q2-m9xd-4hpt". */
export function newRecoveryCodes(n = 10): string[] {
  const alph = 'abcdefghjkmnpqrstuvwxyz23456789';
  const out: string[] = [];
  for (let i = 0; i < n; i++) {
    const b = randomBytes(12);
    let s = '';
    for (let j = 0; j < 12; j++) {
      s += alph[b[j]! % alph.length];
      if (j === 3 || j === 7) s += '-';
    }
    out.push(s);
  }
  return out;
}
