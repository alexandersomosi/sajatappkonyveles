// Upload rules (SPEC §12.7): JPEG / PNG / PDF by magic bytes (HEIC is recognised and refused:
// the server cannot read it), ≤ 25 MB per file, ≤ 60 MB per request, ≤ 20 pages per document.
// GPS EXIF is removed from JPEGs; multi-page photo uploads are merged into one PDF.
import { PDFDocument } from 'pdf-lib';
import brand from '../_shared/brand.json' with { type: 'json' };
import { ApiError, E } from '../lib/errors.js';
import { sanitizeDisplayName } from '../lib/validators.js';

export const MAX_FILE_BYTES = 25 * 1024 * 1024;
export const MAX_REQUEST_BYTES = 60 * 1024 * 1024;
/** Routes that take exactly one file (message attachments): the file limit plus multipart overhead. */
export const MAX_SINGLE_FILE_REQUEST_BYTES = 26 * 1024 * 1024;
export const MAX_PAGES = 20;

export type SniffedType = 'image/jpeg' | 'image/png' | 'application/pdf';

export function sniff(buf: Buffer): SniffedType | 'image/heic' | null {
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg';
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';
  if (buf.length >= 5 && buf.subarray(0, 5).toString('latin1') === '%PDF-') return 'application/pdf';
  if (buf.length >= 12 && buf.subarray(4, 8).toString('latin1') === 'ftyp') {
    const brand = buf.subarray(8, 12).toString('latin1');
    if (['heic', 'heix', 'hevc', 'heim', 'heis', 'mif1', 'msf1'].includes(brand)) return 'image/heic';
  }
  return null;
}

export interface IncomingFile {
  name: string;
  data: Buffer;
  declaredType: string;
}

export interface CheckedFile {
  displayName: string;
  data: Buffer;
  mime: SniffedType;
}

/** Largest image we accept: 16 000 px per side, 50 megapixels (a 200 MP phone photo is reduced on the phone). */
export const MAX_SIDE_PX = 16_000;
export const MAX_PIXELS = 50_000_000;
/**
 * PNGs are decoded when merged into a PDF (≈ 4 bytes per pixel, plus pdf-lib's copies). A tiny,
 * solid-colour PNG can declare a huge canvas, so the decoded size is capped well below the API's
 * memory: 8 MP per page and 12 MP per document (QA kör 3: 2 × 30 MP PNGs of 117 KB took +460 MB).
 * The app sends photos as JPEG anyway.
 */
export const MAX_PNG_PIXELS_PER_PAGE = 8_000_000;
export const MAX_PNG_PIXELS_PER_DOC = 12_000_000;

/** At most one merge per user and MERGE_SLOTS merges at a time on the server; a few more may wait. */
export const MERGE_SLOTS = 2;
const MERGE_QUEUE_MAX = 8;
let mergeActive = 0;
const mergeQueue: (() => void)[] = [];
const mergeUsers = new Set<string>();

export async function withMergeSlot<T>(userKey: string, fn: () => Promise<T>): Promise<T> {
  if (mergeUsers.has(userKey)) throw E.rateLimited(5, 'Az előző feltöltésed még készül. Várd meg, és utána küldd a következőt.');
  if (mergeActive >= MERGE_SLOTS) {
    if (mergeQueue.length >= MERGE_QUEUE_MAX) throw E.rateLimited(10, 'Most sokan töltenek fel egyszerre. Próbáld újra pár másodperc múlva.');
    await new Promise<void>((res) => mergeQueue.push(res));
  }
  mergeActive++;
  mergeUsers.add(userKey);
  try {
    return await fn();
  } finally {
    mergeUsers.delete(userKey);
    mergeActive--;
    mergeQueue.shift()?.();
  }
}

/**
 * Large multipart uploads are read whole into memory (≈ 5× the request while parsing, checking and encrypting), so
 * they are let in a few at a time: at most UPLOAD_SLOTS requests at once on the server and one per caller; a few
 * more wait (the body is NOT read while waiting), the rest get 429 + Retry-After. Round 1 (2026-11-19): six
 * parallel 48 MB uploads of one client took +1.2 GB and would have killed the 768 MB API container.
 */
export const UPLOAD_SLOTS = 2;
const UPLOAD_QUEUE_MAX = 12;
const UPLOAD_PER_CALLER_WAITING = 6;
const UPLOAD_WAIT_MS = 45_000;
let uploadActive = 0;
const uploadQueue: { caller: string; go: () => void; cancelled: boolean }[] = [];
const uploadBusy = new Set<string>();
const uploadWaiting = new Map<string, number>();

function nextUpload(): void {
  for (let i = 0; i < uploadQueue.length && uploadActive < UPLOAD_SLOTS; i++) {
    const w = uploadQueue[i]!;
    if (w.cancelled) {
      uploadQueue.splice(i--, 1);
      continue;
    }
    if (uploadBusy.has(w.caller)) continue;
    uploadQueue.splice(i--, 1);
    uploadActive++;
    uploadBusy.add(w.caller);
    w.go();
  }
}

/** SPEC §27.11 S5: an upload request that holds a slot longer than this is answered 408 and its slot is freed. */
export const UPLOAD_DEADLINE_MS = 120_000;

export async function withUploadSlot<T>(caller: string, fn: () => Promise<T>, o: { deadlineMs?: number } = {}): Promise<T> {
  if (uploadActive < UPLOAD_SLOTS && !uploadBusy.has(caller)) {
    uploadActive++;
    uploadBusy.add(caller);
  } else {
    const waiting = uploadWaiting.get(caller) ?? 0;
    if (waiting >= UPLOAD_PER_CALLER_WAITING) throw E.rateLimited(5, 'Egyszerre túl sok feltöltést indítottál. Várd meg, amíg az előzők elkészülnek.');
    if (uploadQueue.length >= UPLOAD_QUEUE_MAX) throw E.rateLimited(10, 'Most sokan töltenek fel egyszerre. Próbáld újra pár másodperc múlva.');
    uploadWaiting.set(caller, waiting + 1);
    try {
      await new Promise<void>((res, rej) => {
        const w = { caller, go: () => undefined as void, cancelled: false };
        const timer = setTimeout(() => {
          w.cancelled = true;
          rej(E.rateLimited(10, 'Most sokan töltenek fel egyszerre. Próbáld újra pár másodperc múlva.'));
        }, UPLOAD_WAIT_MS);
        timer.unref?.();
        w.go = () => {
          clearTimeout(timer);
          res();
        };
        uploadQueue.push(w);
      });
    } finally {
      const n = (uploadWaiting.get(caller) ?? 1) - 1;
      if (n > 0) uploadWaiting.set(caller, n);
      else uploadWaiting.delete(caller);
    }
  }
  let timer: NodeJS.Timeout | null = null;
  try {
    if (!o.deadlineMs) return await fn();
    const deadline = new Promise<never>((_, rej) => {
      timer = setTimeout(() => rej(new ApiError(408, 'upload_timeout', 'A feltöltés túl sokáig tartott. Nézd meg az internetkapcsolatot, és próbáld újra.')), o.deadlineMs);
      timer.unref?.();
    });
    const run = fn();
    run.catch(() => undefined); // a late failure after the 408 must not become an unhandled rejection
    return await Promise.race([run, deadline]);
  } finally {
    if (timer) clearTimeout(timer);
    uploadActive--;
    uploadBusy.delete(caller);
    nextUpload();
  }
}

/** Width × height from the PNG IHDR or the JPEG SOFn header, without decoding. Null if not found. */
export function imageSize(buf: Buffer, mime: SniffedType): { w: number; h: number } | null {
  if (mime === 'image/png') {
    if (buf.length < 24 || buf.subarray(12, 16).toString('latin1') !== 'IHDR') return null;
    return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
  }
  if (mime === 'image/jpeg') {
    let off = 2;
    while (off + 9 < buf.length) {
      if (buf[off] !== 0xff) {
        off++;
        continue;
      }
      const marker = buf[off + 1]!;
      if (marker === 0xff) {
        off++;
        continue;
      }
      if (marker === 0xd8 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
        off += 2;
        continue;
      }
      const len = buf.readUInt16BE(off + 2);
      // SOF0..SOF15 except DHT (C4), JPG (C8), DAC (CC)
      if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
        return { h: buf.readUInt16BE(off + 5), w: buf.readUInt16BE(off + 7) };
      }
      if (marker === 0xda || len < 2) return null;
      off += 2 + len;
    }
  }
  return null;
}

export function checkFile(f: IncomingFile, allow: SniffedType[] = ['image/jpeg', 'image/png', 'application/pdf']): CheckedFile {
  if (f.data.length === 0) throw E.validation({ file: 'Üres fájl.' });
  if (f.data.length > MAX_FILE_BYTES) throw E.tooLarge('Egy fájl legfeljebb 25 MB lehet.');
  const t = sniff(f.data);
  if (t === 'image/heic') throw E.unsupported('HEIC képet nem tudunk megnyitni. Küldd JPEG-ként (a telefon „Legkompatibilisebb” beállításával), vagy fotózd az appban.');
  if (!t || !allow.includes(t)) throw E.unsupported('Ezt a fájltípust nem tudjuk fogadni. JPEG, PNG vagy PDF lehet.');
  if (t !== 'application/pdf') {
    // Decompression bombs: a tiny PNG can claim 100 000 × 100 000 pixels; never decode such a file.
    const size = imageSize(f.data, t);
    if (!size || size.w < 1 || size.h < 1) throw E.unsupported('Ezt a képet nem tudjuk megnyitni. Lehet, hogy sérült.');
    if (size.w > MAX_SIDE_PX || size.h > MAX_SIDE_PX || size.w * size.h > MAX_PIXELS) throw E.tooLarge('Ez a kép túl nagy felbontású. Fotózd le újra, vagy küldd kisebb méretben.');
  }
  const data = t === 'image/jpeg' ? stripJpegGps(f.data) : f.data;
  const ext = t === 'application/pdf' ? '.pdf' : t === 'image/png' ? '.png' : '.jpg';
  let name = sanitizeDisplayName(f.name, `fajl${ext}`);
  if (!name.toLowerCase().endsWith(ext) && !(ext === '.jpg' && /\.jpe?g$/i.test(name))) name = `${name.replace(/\.[a-z0-9]{1,5}$/i, '')}${ext}`;
  return { displayName: name.slice(0, 120), data, mime: t };
}

/**
 * Removes GPS data from a JPEG's EXIF (APP1) without touching orientation: the GPS IFD is emptied
 * (entry count 0, entries and out-of-line values zeroed). Unknown/odd structures are left as is.
 */
export function stripJpegGps(buf: Buffer): Buffer {
  const out = Buffer.from(buf);
  let off = 2;
  while (off + 4 <= out.length && out[off] === 0xff) {
    const marker = out[off + 1]!;
    if (marker === 0xda || marker === 0xd9) break; // start of scan / end
    const len = out.readUInt16BE(off + 2);
    if (len < 2 || off + 2 + len > out.length) break;
    if (marker === 0xe1 && out.subarray(off + 4, off + 10).toString('latin1') === 'Exif\0\0') {
      try {
        scrubGpsIfd(out, off + 10, off + 2 + len);
      } catch {
        /* malformed EXIF: leave untouched */
      }
    }
    off += 2 + len;
  }
  return out;
}

function scrubGpsIfd(b: Buffer, tiff: number, end: number): void {
  const le = b.subarray(tiff, tiff + 2).toString('latin1') === 'II';
  const u16 = (p: number) => (le ? b.readUInt16LE(p) : b.readUInt16BE(p));
  const u32 = (p: number) => (le ? b.readUInt32LE(p) : b.readUInt32BE(p));
  const w16 = (p: number, v: number) => (le ? b.writeUInt16LE(v, p) : b.writeUInt16BE(v, p));
  if (u16(tiff + 2) !== 42) return;
  const ifd0 = tiff + u32(tiff + 4);
  if (ifd0 + 2 > end) return;
  const n = u16(ifd0);
  for (let i = 0; i < n; i++) {
    const e = ifd0 + 2 + i * 12;
    if (e + 12 > end) return;
    if (u16(e) !== 0x8825) continue;
    const gps = tiff + u32(e + 8);
    if (gps + 2 > end) return;
    const gn = u16(gps);
    const sizes: Record<number, number> = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
    for (let j = 0; j < gn; j++) {
      const ge = gps + 2 + j * 12;
      if (ge + 12 > end) break;
      const type = u16(ge + 2);
      const count = u32(ge + 4);
      const bytes = (sizes[type] ?? 1) * count;
      if (bytes > 4) {
        const vo = tiff + u32(ge + 8);
        if (vo + bytes <= end) b.fill(0, vo, vo + bytes);
      }
      b.fill(0, ge, ge + 12);
    }
    w16(gps, 0);
  }
}

export async function pdfPageCount(data: Buffer): Promise<number> {
  try {
    const doc = await PDFDocument.load(data, { ignoreEncryption: true, updateMetadata: false });
    return doc.getPageCount();
  } catch {
    throw E.validation({ file: 'Ezt a PDF-et nem tudjuk megnyitni. Lehet, hogy sérült.' });
  }
}

/** Merges 1–20 photos into one A4-width PDF (one photo per page). `slotKey`: one merge per user at a time. */
export async function mergeImagesToPdf(images: CheckedFile[], title: string, slotKey = 'anon'): Promise<Buffer> {
  if (images.length > MAX_PAGES) throw E.validation({ pages: `Legfeljebb ${MAX_PAGES} oldal lehet egy iratban.` });
  let pngPixels = 0;
  for (const img of images) {
    const size = imageSize(img.data, img.mime);
    if (!size) throw E.unsupported('Ezt a képet nem tudjuk megnyitni. Lehet, hogy sérült.');
    if (img.mime === 'image/png') {
      if (size.w * size.h > MAX_PNG_PIXELS_PER_PAGE) throw E.tooLarge('Ez a PNG-kép túl nagy egy oldalnak. Fotózd le újra, vagy küldd JPEG-ként.');
      pngPixels += size.w * size.h;
    }
  }
  if (pngPixels > MAX_PNG_PIXELS_PER_DOC) throw E.tooLarge('Ezek a képek együtt túl nagyok. Küldd JPEG-ként, vagy kevesebb oldalt egyszerre.');
  return withMergeSlot(slotKey, () => buildImagePdf(images, title));
}

async function buildImagePdf(images: CheckedFile[], title: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.setTitle(title);
  doc.setProducer(brand.name); // round-2 owner finding 5: the name lives only in brand.json
  for (const img of images) {
    const emb = img.mime === 'image/png' ? await doc.embedPng(img.data) : await doc.embedJpg(img.data);
    const maxW = 595.28;
    const scale = Math.min(1, maxW / emb.width);
    const w = emb.width * scale;
    const h = emb.height * scale;
    const page = doc.addPage([w, h]);
    page.drawImage(emb, { x: 0, y: 0, width: w, height: h });
  }
  return Buffer.from(await doc.save());
}

/** SPEC §10.2 method 3: the uploaded PDF must contain a signature dictionary. */
export function looksSignedPdf(data: Buffer): boolean {
  const s = data.toString('latin1');
  return s.startsWith('%PDF-') && s.includes('/ByteRange') && s.includes('/Contents') && /\/Type\s*\/Sig\b|\/FT\s*\/Sig\b|\/SubFilter/.test(s);
}

/** Reads multipart files from a Hono parseBody({ all: true }) result. */
export async function collectFiles(body: Record<string, unknown>, field: string): Promise<IncomingFile[]> {
  const raw = body[field] ?? body[`${field}[]`];
  const list = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
  const out: IncomingFile[] = [];
  for (const f of list) {
    if (typeof f === 'object' && f !== null && 'arrayBuffer' in f) {
      const file = f as File;
      out.push({ name: file.name, declaredType: file.type, data: Buffer.from(await file.arrayBuffer()) });
    }
  }
  return out;
}
