// Encrypted file store (SPEC §4.4, §14): /data/files/<clientId|_system>/<yyyy>/<mm>/<fileId>.kjf.
// Blob = AES-256-GCM with AAD = file id; the DB row keeps mime, size, plaintext sha256 and key id.
import { randomUUID } from 'node:crypto';
import { createReadStream, createWriteStream } from 'node:fs';
import { mkdir, open as openFile, readFile, rename, stat, unlink, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import type { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { dirname, join, resolve, sep } from 'node:path';
import { eq } from 'drizzle-orm';
import type { Config } from '../config.js';
import { decryptFileBlob, encryptFileBlob, FILE_BLOB_HEAD, FILE_BLOB_TAG, fileBlobDecryptor, fileBlobEncryptor, sha256Hex } from '../lib/crypto.js';
import type { DbOrTx } from '../db/client.js';
import { files } from '../db/schema.js';

export type FileKind = (typeof files.$inferSelect)['kind'];
export type FileRow = typeof files.$inferSelect;

export interface PutFile {
  ownerClientId: string | null;
  kind: FileKind;
  mime: string;
  displayName: string;
  data: Buffer;
  createdBy?: string | null;
  retentionUntil?: string | null;
  now?: Date;
}

export class FileStorage {
  private readonly root: string;
  constructor(private readonly cfg: Pick<Config, 'filesDir' | 'fileEncKey' | 'fileEncKeyId'>) {
    this.root = resolve(cfg.filesDir);
  }

  private keyFor = (id: number): Buffer | undefined => (id === this.cfg.fileEncKeyId ? this.cfg.fileEncKey : undefined);

  private abs(storagePath: string): string {
    const p = resolve(this.root, storagePath);
    if (p !== this.root && !p.startsWith(this.root + sep)) throw new Error('storage path escapes root');
    return p;
  }

  /** Encrypts and writes the blob, then inserts the row. Returns the row. */
  async put(db: DbOrTx, f: PutFile): Promise<FileRow> {
    const id = randomUUID();
    const d = f.now ?? new Date();
    const yyyy = String(d.getUTCFullYear());
    const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
    const owner = f.ownerClientId ?? '_system';
    if (!/^[0-9a-f-]{36}$|^_system$/.test(owner)) throw new Error('bad owner');
    const storagePath = [owner, yyyy, mm, `${id}.kjf`].join('/');
    const blob = encryptFileBlob(this.cfg.fileEncKey, this.cfg.fileEncKeyId, f.data, id);
    const target = this.abs(storagePath);
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    const tmp = `${target}.tmp-${process.pid}`;
    await writeFile(tmp, blob, { mode: 0o600 });
    await rename(tmp, target);
    try {
      const [row] = await db
        .insert(files)
        .values({
          id,
          ownerClientId: f.ownerClientId,
          kind: f.kind,
          mime: f.mime,
          sizeBytes: f.data.length,
          sha256: sha256Hex(f.data),
          keyId: this.cfg.fileEncKeyId,
          storagePath,
          displayName: f.displayName,
          createdBy: f.createdBy ?? null,
          retentionUntil: f.retentionUntil ?? null,
        })
        .returning();
      return row!;
    } catch (e) {
      await unlink(target).catch(() => undefined);
      throw e;
    }
  }

  /** A private scratch file inside the store (same volume, mode 600) – for building large blobs without holding them in memory. */
  async tmpFile(name: string): Promise<string> {
    const dir = this.abs('_tmp');
    await mkdir(dir, { recursive: true, mode: 0o700 });
    return join(dir, `${name.replace(/[^A-Za-z0-9._-]/g, '_')}.${process.pid}.${randomUUID().slice(0, 8)}`);
  }

  /**
   * Like put(), but the plaintext comes from a file and is encrypted as a stream (constant memory): for the GDPR
   * export ZIP, which can be hundreds of MB. Same KJF1 blob layout, so read() / readStream() open it the same way.
   */
  async putFromFile(db: DbOrTx, f: Omit<PutFile, 'data'> & { sourcePath: string }): Promise<FileRow> {
    const id = randomUUID();
    const d = f.now ?? new Date();
    const owner = f.ownerClientId ?? '_system';
    if (!/^[0-9a-f-]{36}$|^_system$/.test(owner)) throw new Error('bad owner');
    const storagePath = [owner, String(d.getUTCFullYear()), String(d.getUTCMonth() + 1).padStart(2, '0'), `${id}.kjf`].join('/');
    const target = this.abs(storagePath);
    await mkdir(dirname(target), { recursive: true, mode: 0o700 });
    const tmp = `${target}.tmp-${process.pid}`;
    const { header, cipher } = fileBlobEncryptor(this.cfg.fileEncKey, this.cfg.fileEncKeyId, id);
    const hash = createHash('sha256');
    let size = 0;
    const out = createWriteStream(tmp, { mode: 0o600 });
    try {
      out.write(header);
      const src = createReadStream(f.sourcePath);
      src.on('data', (chunk) => {
        hash.update(chunk as Buffer);
        size += (chunk as Buffer).length;
      });
      await pipeline(src, cipher, out, { end: false });
      await new Promise<void>((res, rej) => out.end(cipher.getAuthTag(), (err?: Error | null) => (err ? rej(err) : res())));
      await rename(tmp, target);
    } catch (e) {
      out.destroy();
      await unlink(tmp).catch(() => undefined);
      throw e;
    }
    try {
      const [row] = await db
        .insert(files)
        .values({ id, ownerClientId: f.ownerClientId, kind: f.kind, mime: f.mime, sizeBytes: size, sha256: hash.digest('hex'), keyId: this.cfg.fileEncKeyId, storagePath, displayName: f.displayName, createdBy: f.createdBy ?? null, retentionUntil: f.retentionUntil ?? null })
        .returning();
      return row!;
    } catch (e) {
      await unlink(target).catch(() => undefined);
      throw e;
    }
  }

  /** Decrypting stream of a blob (constant memory). The auth tag is checked at the end: a tampered blob ends the stream with an error. */
  async readStream(row: Pick<FileRow, 'id' | 'storagePath'>): Promise<{ stream: Readable; size: number }> {
    const path = this.abs(row.storagePath);
    const st = await stat(path);
    if (st.size < FILE_BLOB_HEAD + FILE_BLOB_TAG) throw new Error('blob too short');
    const fh = await openFile(path, 'r');
    let head: Buffer;
    let tag: Buffer;
    try {
      head = Buffer.alloc(FILE_BLOB_HEAD);
      tag = Buffer.alloc(FILE_BLOB_TAG);
      await fh.read(head, 0, FILE_BLOB_HEAD, 0);
      await fh.read(tag, 0, FILE_BLOB_TAG, st.size - FILE_BLOB_TAG);
    } finally {
      await fh.close();
    }
    const decipher = fileBlobDecryptor(this.keyFor, head, tag, row.id);
    const size = st.size - FILE_BLOB_HEAD - FILE_BLOB_TAG;
    if (size === 0) {
      decipher.end();
      return { stream: decipher, size };
    }
    const src = createReadStream(path, { start: FILE_BLOB_HEAD, end: st.size - FILE_BLOB_TAG - 1 });
    src.on('error', (err) => decipher.destroy(err));
    return { stream: src.pipe(decipher), size };
  }

  async read(row: Pick<FileRow, 'id' | 'storagePath'>): Promise<Buffer> {
    const blob = await readFile(this.abs(row.storagePath));
    return decryptFileBlob(this.keyFor, blob, row.id);
  }

  async readById(db: DbOrTx, id: string): Promise<{ row: FileRow; data: Buffer } | null> {
    const [row] = await db.select().from(files).where(eq(files.id, id)).limit(1);
    if (!row || row.deletedAt) return null;
    return { row, data: await this.read(row) };
  }

  /** Physically removes a blob (GDPR deletion / retention purge only). */
  async purgeBlob(row: Pick<FileRow, 'storagePath'>): Promise<void> {
    await unlink(this.abs(row.storagePath)).catch(() => undefined);
  }

  rawPath(row: Pick<FileRow, 'storagePath'>): string {
    return join(this.abs(row.storagePath));
  }
}
