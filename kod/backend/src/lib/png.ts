// Tiny PNG writer for demo images (grey "receipt" pictures in the seed). No dependency.
import { crc32, deflateSync } from 'node:zlib';

function chunk(type: string, data: Buffer): Buffer {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td) >>> 0);
  return Buffer.concat([len, td, crc]);
}

/** A receipt-like picture: light paper on a darker table with grey "text" lines. */
export function demoReceiptPng(width = 600, height = 900, seed = 1): Buffer {
  const rows: Buffer[] = [];
  let s = seed >>> 0;
  const rnd = () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
  const lineLens = Array.from({ length: 40 }, () => 0.3 + rnd() * 0.6);
  for (let y = 0; y < height; y++) {
    const row = Buffer.alloc(1 + width * 3);
    row[0] = 0;
    for (let x = 0; x < width; x++) {
      let r = 120;
      let g = 116;
      let b = 108;
      const inPaper = x > 80 && x < width - 80 && y > 40 && y < height - 40;
      if (inPaper) {
        r = 246;
        g = 244;
        b = 238;
        const ly = y - 100;
        const li = Math.floor(ly / 34);
        if (ly > 0 && ly % 34 < 9 && li < lineLens.length && x < 110 + (width - 220) * lineLens[li]!) {
          r = g = b = 150;
        }
      }
      row[1 + x * 3] = r;
      row[2 + x * 3] = g;
      row[3 + x * 3] = b;
    }
    rows.push(row);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(Buffer.concat(rows))),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
