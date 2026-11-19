// Pure units: TOTP (RFC 6238 vectors), base32, AES-GCM blobs and fields (AAD tamper), validators,
// SimplePay signatures, log redaction, dates, uploads, zip.
import { createHmac } from 'node:crypto';
import { Writable } from 'node:stream';
import { inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { base32Decode, base32Encode, hotp, totp, verifyTotp } from '../src/lib/totp.js';
import { decryptFileBlob, DecryptError, encryptFileBlob, FieldCipher } from '../src/lib/crypto.js';
import { isValidAdoazonositoJel, isValidAdoszam, sanitizeDisplayName } from '../src/lib/validators.js';
import { spSign, spVerify, decodeBack } from '../src/payments/simplepay.js';
import { createLogger } from '../src/log.js';
import { addMonths, budapestLocalToUtc, isoWeekOf, mondayOfIsoWeek, todayBudapest } from '../src/lib/dates.js';
import { passwordProblem } from '../src/lib/password.js';
import { sniff, stripJpegGps } from '../src/files/upload.js';
import { zip } from '../src/lib/zip.js';
import fixtures from '../src/_shared/demo/fixtures.json' with { type: 'json' };

describe('TOTP (RFC 6238 Appendix B, SHA-1)', () => {
  const secret = Buffer.from('12345678901234567890', 'ascii');
  const vectors: [number, string][] = [
    [59, '94287082'],
    [1111111109, '07081804'],
    [1111111111, '14050471'],
    [1234567890, '89005924'],
    [2000000000, '69279037'],
    [20000000000, '65353130'],
  ];
  for (const [t, code] of vectors) it(`T=${t}`, () => expect(totp(secret, t * 1000, { digits: 8 })).toBe(code));
  it('HOTP RFC 4226 counter 0..2', () => {
    expect(hotp(secret, 0)).toBe('755224');
    expect(hotp(secret, 1)).toBe('287082');
    expect(hotp(secret, 2)).toBe('359152');
  });
  it('accepts ±1 step, rejects ±2', () => {
    const now = 1_700_000_000_000;
    expect(verifyTotp(secret, totp(secret, now - 30_000), now)).not.toBeNull();
    expect(verifyTotp(secret, totp(secret, now - 60_000), now)).toBeNull();
  });
  it('base32 round trip (RFC 4648 "foobar")', () => {
    expect(base32Encode(Buffer.from('foobar'))).toBe('MZXW6YTBOI');
    expect(base32Decode('MZXW6YTBOI').toString()).toBe('foobar');
  });
});

describe('encryption at rest', () => {
  const key = Buffer.alloc(32, 9);
  it('file blob round trip, header format', () => {
    const blob = encryptFileBlob(key, 1, Buffer.from('titkos irat'), 'file-1');
    expect(blob.subarray(0, 4).toString()).toBe('KJF1');
    expect(blob[4]).toBe(1);
    expect(decryptFileBlob(() => key, blob, 'file-1').toString()).toBe('titkos irat');
  });
  it('AAD (file id) tamper fails', () => {
    const blob = encryptFileBlob(key, 1, Buffer.from('x'), 'file-1');
    expect(() => decryptFileBlob(() => key, blob, 'file-2')).toThrow(DecryptError);
  });
  it('ciphertext tamper fails', () => {
    const blob = encryptFileBlob(key, 1, Buffer.from('xyz'), 'f');
    blob[18] = blob[18]! ^ 1;
    expect(() => decryptFileBlob(() => key, blob, 'f')).toThrow(DecryptError);
  });
  it('field cipher binds the purpose', () => {
    const c = new FieldCipher(key);
    const v = c.enc('8417104569', 'clients.adoazonosito_jel');
    expect(Buffer.from(v, 'base64').subarray(0, 4).toString()).toBe('KJD1');
    expect(c.dec(v, 'clients.adoazonosito_jel')).toBe('8417104569');
    expect(() => c.dec(v, 'clients.phone')).toThrow();
  });
});

describe('validators (fixtures are formally valid)', () => {
  it('adószám + adóazonosító jel of the demo people', () => {
    for (const k of ['kata', 'reka', 'peter'] as const) {
      expect(isValidAdoszam(fixtures.taxIds[k].adoszam)).toBe(true);
      expect(isValidAdoazonositoJel(fixtures.taxIds[k].adoazonositoJel)).toBe(true);
    }
    expect(isValidAdoazonositoJel(fixtures.taxIds.bence.adoazonositoJel)).toBe(true);
    expect(isValidAdoszam('68801235-1-41')).toBe(false);
    expect(isValidAdoazonositoJel('8417104568')).toBe(false);
  });
  it('display names lose path parts', () => {
    expect(sanitizeDisplayName('../../etc/passwd')).toBe('passwd');
    expect(sanitizeDisplayName('C:\\x\\nyugta<1>.jpg')).toBe('nyugta1.jpg');
  });
  it('password rule', () => {
    expect(passwordProblem('rovid')).toMatch(/10/);
    expect(passwordProblem('1234567890')).toBeTruthy();
    expect(passwordProblem('qwertzuiop')).toBeTruthy();
    expect(passwordProblem('katalin.szabo99', 'katalin.szabo99@x.hu')).toBeTruthy();
    expect(passwordProblem('Hosszu-Demo-Jelszo-2026!')).toBeNull();
  });
});

describe('SimplePay signature (HMAC-SHA384, base64)', () => {
  it('matches an independent HMAC computation and verifies', () => {
    const secret = 'FxDa5w314kLlNseq2sKuVwaqZshZT5d6';
    const body = '{"salt":"c1ca1d0e9fc2323b3dda7cf145e36f5e","merchant":"PUBLICTESTHUF","orderRef":"101010516348232058105","currency":"HUF","total":"25"}';
    const expected = createHmac('sha384', secret).update(body).digest('base64');
    expect(spSign(secret, body)).toBe(expected);
    expect(spVerify(secret, body, expected)).toBe(true);
    expect(spVerify(secret, `${body} `, expected)).toBe(false);
    expect(spVerify(secret, body, null)).toBe(false);
  });
  it('decodes the back URL r parameter', () => {
    const r = Buffer.from('{"r":0,"t":99844942,"e":"SUCCESS","m":"PUBLICTESTHUF","o":"KJ-1"}').toString('base64');
    expect(decodeBack(r)).toMatchObject({ e: 'SUCCESS', t: 99844942, o: 'KJ-1' });
    expect(decodeBack('%%%')).toBeNull();
  });
});

describe('log redaction', () => {
  it('never prints secrets, e-mails, codes or bodies', () => {
    let out = '';
    const sink = new Writable({
      write(chunk, _e, cb) {
        out += chunk.toString();
        cb();
      },
    });
    const l = createLogger('info', sink as never);
    l.info(
      { email: 'kata@x.hu', password: 'p', code: '123456', req: { headers: { authorization: 'Bearer abc', cookie: 'kj_rt=1' } }, body: 'üzenet', nested: { token: 'tokenvalue', signatureKey: 'keyvalue' } },
      'x',
    );
    expect(out).not.toMatch(/kata@x\.hu|123456|Bearer abc|kj_rt=1|üzenet|tokenvalue|keyvalue/);
    expect(out).toContain('[rejtve]');
  });
});

describe('dates', () => {
  it('Budapest date and DST-safe local → UTC', () => {
    expect(todayBudapest(new Date('2026-11-17T23:30:00Z'))).toBe('2026-11-18');
    expect(budapestLocalToUtc('2026-12-08', '09:00').toISOString()).toBe('2026-12-08T08:00:00.000Z');
    expect(budapestLocalToUtc('2026-07-08', '09:00').toISOString()).toBe('2026-07-08T07:00:00.000Z');
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28');
    expect(isoWeekOf('2026-11-17').key).toBe('2026-W47');
    expect(mondayOfIsoWeek('2026-W47')).toBe('2026-11-16');
  });
});

describe('uploads', () => {
  it('sniffs magic bytes, recognises HEIC', () => {
    expect(sniff(Buffer.from('%PDF-1.7'))).toBe('application/pdf');
    expect(sniff(Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe('image/jpeg');
    const heic = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypheic')]);
    expect(sniff(heic)).toBe('image/heic');
    expect(sniff(Buffer.from('<html>'))).toBeNull();
  });
  it('removes the GPS IFD from EXIF', () => {
    const tiff = Buffer.alloc(64);
    tiff.write('II', 0, 'latin1');
    tiff.writeUInt16LE(42, 2);
    tiff.writeUInt32LE(8, 4);
    tiff.writeUInt16LE(1, 8);
    tiff.writeUInt16LE(0x8825, 10);
    tiff.writeUInt16LE(4, 12);
    tiff.writeUInt32LE(1, 14);
    tiff.writeUInt32LE(26, 18);
    tiff.writeUInt16LE(1, 26);
    tiff.writeUInt16LE(1, 28);
    tiff.writeUInt16LE(2, 30);
    tiff.writeUInt32LE(2, 32);
    tiff.write('N\0', 36, 'latin1');
    const app1 = Buffer.concat([Buffer.from('Exif\0\0', 'latin1'), tiff]);
    const seg = Buffer.alloc(4);
    seg[0] = 0xff;
    seg[1] = 0xe1;
    seg.writeUInt16BE(app1.length + 2, 2);
    const jpg = Buffer.concat([Buffer.from([0xff, 0xd8]), seg, app1, Buffer.from([0xff, 0xd9])]);
    const out = stripJpegGps(jpg);
    const t = 2 + 4 + 6;
    expect(out.readUInt16LE(t + 26)).toBe(0);
    expect(out.subarray(t + 36, t + 38).toString('latin1')).toBe('\0\0');
  });
});

describe('zip writer', () => {
  it('writes readable entries', () => {
    const z = zip([{ name: 'a.json', data: Buffer.from('{"x":1}'.repeat(50)) }]);
    expect(z.readUInt32LE(0)).toBe(0x04034b50);
    const nameLen = z.readUInt16LE(26);
    const compSize = z.readUInt32LE(18);
    const method = z.readUInt16LE(8);
    const data = z.subarray(30 + nameLen, 30 + nameLen + compSize);
    const plain = method === 8 ? inflateRawSync(data) : data;
    expect(plain.toString()).toContain('{"x":1}');
  });
});
