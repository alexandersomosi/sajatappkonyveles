// Encryption at rest and small crypto helpers (SPEC §4.4).
//  - Files:  "KJF1" (4 B) · keyId (1 B) · iv (12 B) · ciphertext · tag (16 B); AES-256-GCM, AAD = file id.
//  - Fields: base64("KJD1" · keyId · iv · ct · tag); AES-256-GCM, AAD = purpose label (column).
import { createCipheriv, createDecipheriv, createHash, createHmac, hkdfSync, randomBytes, timingSafeEqual } from 'node:crypto';

const FILE_MAGIC = Buffer.from('KJF1', 'ascii');
const FIELD_MAGIC = Buffer.from('KJD1', 'ascii');
const IV_LEN = 12;
const TAG_LEN = 16;

export class DecryptError extends Error {
  constructor(msg = 'decrypt failed') {
    super(msg);
    this.name = 'DecryptError';
  }
}

function seal(magic: Buffer, key: Buffer, keyId: number, plain: Buffer, aad: string): Buffer {
  if (key.length !== 32) throw new Error('key must be 32 bytes');
  const iv = randomBytes(IV_LEN);
  const c = createCipheriv('aes-256-gcm', key, iv);
  c.setAAD(Buffer.from(aad, 'utf8'));
  const ct = Buffer.concat([c.update(plain), c.final()]);
  return Buffer.concat([magic, Buffer.from([keyId & 0xff]), iv, ct, c.getAuthTag()]);
}

function open(magic: Buffer, keys: (id: number) => Buffer | undefined, blob: Buffer, aad: string): Buffer {
  if (blob.length < 4 + 1 + IV_LEN + TAG_LEN || !blob.subarray(0, 4).equals(magic)) throw new DecryptError('bad header');
  const keyId = blob[4]!;
  const key = keys(keyId);
  if (!key) throw new DecryptError(`unknown key id ${keyId}`);
  const iv = blob.subarray(5, 5 + IV_LEN);
  const tag = blob.subarray(blob.length - TAG_LEN);
  const ct = blob.subarray(5 + IV_LEN, blob.length - TAG_LEN);
  try {
    const d = createDecipheriv('aes-256-gcm', key, iv);
    d.setAAD(Buffer.from(aad, 'utf8'));
    d.setAuthTag(tag);
    return Buffer.concat([d.update(ct), d.final()]);
  } catch {
    throw new DecryptError('auth tag mismatch');
  }
}

export function encryptFileBlob(key: Buffer, keyId: number, plain: Buffer, fileId: string): Buffer {
  return seal(FILE_MAGIC, key, keyId, plain, fileId);
}

export function decryptFileBlob(keys: (id: number) => Buffer | undefined, blob: Buffer, fileId: string): Buffer {
  return open(FILE_MAGIC, keys, blob, fileId);
}

/** Streaming variant of encryptFileBlob (same KJF1 layout): write `header`, pipe the plaintext through `cipher`, then append `cipher.getAuthTag()`. */
export function fileBlobEncryptor(key: Buffer, keyId: number, fileId: string) {
  if (key.length !== 32) throw new Error('key must be 32 bytes');
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(fileId, 'utf8'));
  return { header: Buffer.concat([FILE_MAGIC, Buffer.from([keyId & 0xff]), iv]), cipher };
}

/** Streaming variant of decryptFileBlob: `head` = the first FILE_BLOB_HEAD bytes, `tag` = the last FILE_BLOB_TAG bytes of the blob. */
export const FILE_BLOB_HEAD = 4 + 1 + IV_LEN;
export const FILE_BLOB_TAG = TAG_LEN;
export function fileBlobDecryptor(keys: (id: number) => Buffer | undefined, head: Buffer, tag: Buffer, fileId: string) {
  if (head.length !== FILE_BLOB_HEAD || tag.length !== TAG_LEN || !head.subarray(0, 4).equals(FILE_MAGIC)) throw new DecryptError('bad header');
  const key = keys(head[4]!);
  if (!key) throw new DecryptError(`unknown key id ${head[4]}`);
  const d = createDecipheriv('aes-256-gcm', key, head.subarray(5));
  d.setAAD(Buffer.from(fileId, 'utf8'));
  d.setAuthTag(tag);
  return d;
}

/** A field cipher bound to one key (APP_DATA_KEY or the separate NAV_CRED_KEY). */
export class FieldCipher {
  constructor(
    private readonly key: Buffer,
    private readonly keyId = 1,
  ) {}
  enc(value: string, purpose: string): string {
    return seal(FIELD_MAGIC, this.key, this.keyId, Buffer.from(value, 'utf8'), purpose).toString('base64');
  }
  dec(stored: string, purpose: string): string {
    return open(FIELD_MAGIC, (id) => (id === this.keyId ? this.key : undefined), Buffer.from(stored, 'base64'), purpose).toString('utf8');
  }
  encJson(value: unknown, purpose: string): string {
    return this.enc(JSON.stringify(value), purpose);
  }
  decJson<T>(stored: string, purpose: string): T {
    return JSON.parse(this.dec(stored, purpose)) as T;
  }
}

export function sha256Hex(data: string | Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

export function hmacHex(key: Buffer, data: string): string {
  return createHmac('sha256', key).update(data, 'utf8').digest('hex');
}

/** Derive an independent sub-key (HKDF-SHA256) so one env key can serve several purposes. */
export function subKey(master: Buffer, label: string): Buffer {
  return Buffer.from(hkdfSync('sha256', master, Buffer.alloc(0), Buffer.from(label, 'utf8'), 32));
}

export function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url');
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ab.length !== bb.length) {
    timingSafeEqual(ab, ab);
    return false;
  }
  return timingSafeEqual(ab, bb);
}

const B32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
export function randomBase32(len: number): string {
  const b = randomBytes(len);
  let s = '';
  for (let i = 0; i < len; i++) s += B32[b[i]! & 31];
  return s;
}

/** 6-digit numeric code, uniform. */
export function randomDigits(n = 6): string {
  let s = '';
  while (s.length < n) {
    const b = randomBytes(1)[0]!;
    if (b < 250) s += String(b % 10);
  }
  return s;
}
