// Minimal ZIP writer (deflate, UTF-8 names) for GDPR exports. No external dependency.
import { open as openFile, type FileHandle } from 'node:fs/promises';
import { crc32, deflateRawSync } from 'node:zlib';

export interface ZipEntry {
  name: string;
  data: Buffer;
  date?: Date;
}

function dosTime(d: Date): { time: number; date: number } {
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((Math.max(1980, d.getFullYear()) - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

export function zip(entries: ZipEntry[]): Buffer {
  const locals: Buffer[] = [];
  const centrals: Buffer[] = [];
  let offset = 0;
  for (const e of entries) {
    const name = Buffer.from(e.name.replace(/\\/g, '/'), 'utf8');
    const comp = deflateRawSync(e.data, { level: 6 });
    const useStore = comp.length >= e.data.length;
    const body = useStore ? e.data : comp;
    const method = useStore ? 0 : 8;
    const crc = crc32(e.data) >>> 0;
    const { time, date } = dosTime(e.date ?? new Date());
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6); // UTF-8 names
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    locals.push(local, name, body);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(e.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(offset, 42);
    centrals.push(central, name);
    offset += 30 + name.length + body.length;
  }
  const cd = Buffer.concat(centrals);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(cd.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, cd, end]);
}

/** Classic ZIP (no ZIP64): offsets and sizes are 32-bit, at most 65 535 entries. The writer stops a little below. */
export const ZIP_MAX_BYTES = 3_800_000_000;
export const ZIP_MAX_ENTRIES = 60_000;

/**
 * ZIP written straight to a file, one entry at a time: only the entry being added is in memory (≤ one uploaded
 * file), never the whole archive. Already-compressed data (JPEG, PNG, PDF) is stored, not deflated again.
 * Round 1 (2026-11-19): the GDPR export built the whole ZIP in memory (≈ 5× the data) and killed the worker.
 */
export class ZipFileWriter {
  private centrals: Buffer[] = [];
  private offset = 0;
  private count = 0;
  private constructor(private readonly fh: FileHandle) {}

  static async create(path: string): Promise<ZipFileWriter> {
    return new ZipFileWriter(await openFile(path, 'w', 0o600));
  }

  get bytes(): number {
    return this.offset;
  }
  get entries(): number {
    return this.count;
  }
  /** Whether an entry of this size still fits (leaves room for the central directory). */
  fits(size: number): boolean {
    return this.count < ZIP_MAX_ENTRIES && this.offset + size + 200 < ZIP_MAX_BYTES;
  }

  async add(e: ZipEntry, o: { store?: boolean } = {}): Promise<void> {
    if (!this.fits(e.data.length)) throw new Error('zip too large');
    const name = Buffer.from(e.name.replace(/\\/g, '/'), 'utf8');
    let body = e.data;
    let method = 0;
    if (!o.store && e.data.length > 0) {
      const comp = deflateRawSync(e.data, { level: 6 });
      if (comp.length < e.data.length) {
        body = comp;
        method = 8;
      }
    }
    const crc = crc32(e.data) >>> 0;
    const { time, date } = dosTime(e.date ?? new Date());
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(method, 8);
    local.writeUInt16LE(time, 10);
    local.writeUInt16LE(date, 12);
    local.writeUInt32LE(crc, 14);
    local.writeUInt32LE(body.length, 18);
    local.writeUInt32LE(e.data.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(method, 10);
    central.writeUInt16LE(time, 12);
    central.writeUInt16LE(date, 14);
    central.writeUInt32LE(crc, 16);
    central.writeUInt32LE(body.length, 20);
    central.writeUInt32LE(e.data.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt32LE(this.offset, 42);
    this.centrals.push(central, name);
    await this.fh.write(local);
    await this.fh.write(name);
    if (body.length) await this.fh.write(body);
    this.offset += 30 + name.length + body.length;
    this.count++;
  }

  /** Writes the central directory and closes the file. Returns the archive size. */
  async finish(): Promise<number> {
    const cd = Buffer.concat(this.centrals);
    const end = Buffer.alloc(22);
    end.writeUInt32LE(0x06054b50, 0);
    end.writeUInt16LE(this.count, 8);
    end.writeUInt16LE(this.count, 10);
    end.writeUInt32LE(cd.length, 12);
    end.writeUInt32LE(this.offset, 16);
    await this.fh.write(cd);
    await this.fh.write(end);
    await this.fh.close();
    return this.offset + cd.length + 22;
  }

  async abort(): Promise<void> {
    await this.fh.close().catch(() => undefined);
  }
}
