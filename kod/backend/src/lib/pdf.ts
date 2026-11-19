// Small PDF typesetter (pdf-lib + fontkit + Geist TTF → correct ő/ű). Supports exactly the
// Markdown subset of SPEC §21: '#', '##' headings, paragraphs, '-' lists, **bold**.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import fontkit from '@pdf-lib/fontkit';
import { PDFDocument, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import brand from '../_shared/brand.json' with { type: 'json' };

// Colours = the app palette (dizajn/PALETTA.md, 11-18 17:50): body text = --tinta #10152B, secondary = --halvany #505873.
const INK = rgb(0x10 / 255, 0x15 / 255, 0x2b / 255);
const GREY = rgb(0x50 / 255, 0x58 / 255, 0x73 / 255);
const RED = rgb(0.7, 0.12, 0.12);

let fontCache: { regular: Buffer; semibold: Buffer } | null = null;
export function loadFonts(fontDir: string): { regular: Buffer; semibold: Buffer } {
  if (!fontCache) {
    fontCache = {
      regular: readFileSync(join(fontDir, 'Geist-Regular.ttf')),
      semibold: readFileSync(join(fontDir, 'Geist-SemiBold.ttf')),
    };
  }
  return fontCache;
}

interface Typesetter {
  doc: PDFDocument;
  reg: PDFFont;
  bold: PDFFont;
  page: PDFPage;
  y: number;
}

const A4: [number, number] = [595.28, 841.89];
const M = 56;

async function begin(fontDir: string, title: string): Promise<Typesetter> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const f = loadFonts(fontDir);
  const reg = await doc.embedFont(f.regular, { subset: true });
  const bold = await doc.embedFont(f.semibold, { subset: true });
  doc.setTitle(title);
  doc.setProducer(brand.name);
  doc.setCreationDate(new Date(0));
  doc.setModificationDate(new Date(0));
  const page = doc.addPage(A4);
  return { doc, reg, bold, page, y: A4[1] - M };
}

function newPage(t: Typesetter): void {
  t.page = t.doc.addPage(A4);
  t.y = A4[1] - M;
}

type Run = { text: string; bold: boolean };
function parseInline(s: string): Run[] {
  const runs: Run[] = [];
  const parts = s.split(/(\*\*[^*]+\*\*)/g);
  for (const p of parts) {
    if (!p) continue;
    if (p.startsWith('**') && p.endsWith('**')) runs.push({ text: p.slice(2, -2), bold: true });
    else runs.push({ text: p, bold: false });
  }
  return runs;
}

function writeRuns(t: Typesetter, runs: Run[], size: number, indent = 0, color = INK): void {
  const maxW = A4[0] - 2 * M - indent;
  const lineH = size * 1.45;
  type Word = { text: string; bold: boolean };
  const words: Word[] = [];
  for (const r of runs) for (const w of r.text.split(/(\s+)/)) if (w) words.push({ text: w, bold: r.bold });
  let line: Word[] = [];
  let width = 0;
  const flush = () => {
    if (t.y - lineH < M) newPage(t);
    let x = M + indent;
    for (const w of line) {
      const font = w.bold ? t.bold : t.reg;
      t.page.drawText(w.text, { x, y: t.y - size, size, font, color });
      x += font.widthOfTextAtSize(w.text, size);
    }
    t.y -= lineH;
    line = [];
    width = 0;
  };
  for (const w of words) {
    const font = w.bold ? t.bold : t.reg;
    const ww = font.widthOfTextAtSize(w.text, size);
    if (/^\s+$/.test(w.text)) {
      if (line.length) {
        line.push(w);
        width += ww;
      }
      continue;
    }
    if (width + ww > maxW && line.length) {
      while (line.length && /^\s+$/.test(line[line.length - 1]!.text)) line.pop();
      flush();
    }
    line.push(w);
    width += ww;
  }
  if (line.length) flush();
}

export async function markdownToPdf(fontDir: string, title: string, markdown: string, opts: { banner?: string } = {}): Promise<Buffer> {
  const t = await begin(fontDir, title);
  if (opts.banner) {
    writeRuns(t, [{ text: opts.banner, bold: true }], 10, 0, RED);
    t.y -= 6;
  }
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  let para: string[] = [];
  const flushPara = () => {
    if (para.length) {
      writeRuns(t, parseInline(para.join(' ')), 10.5);
      t.y -= 5;
      para = [];
    }
  };
  for (const raw of lines) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushPara();
      continue;
    }
    if (line.startsWith('## ')) {
      flushPara();
      t.y -= 6;
      writeRuns(t, [{ text: line.slice(3), bold: true }], 12.5);
      t.y -= 2;
    } else if (line.startsWith('# ')) {
      flushPara();
      writeRuns(t, [{ text: line.slice(2), bold: true }], 17);
      t.y -= 6;
    } else if (/^\s*[-*] /.test(line)) {
      flushPara();
      const text = line.replace(/^\s*[-*] /, '');
      if (t.y - 15 < M) newPage(t);
      t.page.drawText('•', { x: M + 4, y: t.y - 10.5, size: 10.5, font: t.reg, color: INK });
      writeRuns(t, parseInline(text), 10.5, 16);
      t.y -= 2;
    } else {
      para.push(line.trim());
    }
  }
  flushPara();
  return Buffer.from(await t.doc.save());
}

/** A simple table document: title, subtitle lines, rows of [left, right]. Used for demo statements and fee requests. */
export async function simpleTablePdf(
  fontDir: string,
  o: { title: string; banner?: string; header: string[]; rows: [string, string][]; footer?: string[] },
): Promise<Buffer> {
  const t = await begin(fontDir, o.title);
  if (o.banner) {
    writeRuns(t, [{ text: o.banner, bold: true }], 11, 0, RED);
    t.y -= 6;
  }
  writeRuns(t, [{ text: o.title, bold: true }], 17);
  t.y -= 4;
  for (const h of o.header) writeRuns(t, [{ text: h, bold: false }], 10, 0, GREY);
  t.y -= 10;
  for (const [l, r] of o.rows) {
    if (t.y - 18 < M) newPage(t);
    t.page.drawText(l, { x: M, y: t.y - 10.5, size: 10.5, font: t.reg, color: INK });
    const w = t.bold.widthOfTextAtSize(r, 10.5);
    t.page.drawText(r, { x: A4[0] - M - w, y: t.y - 10.5, size: 10.5, font: t.bold, color: INK });
    t.y -= 16;
    t.page.drawLine({ start: { x: M, y: t.y + 3 }, end: { x: A4[0] - M, y: t.y + 3 }, thickness: 0.3, color: rgb(0.85, 0.87, 0.9) });
  }
  t.y -= 10;
  for (const f of o.footer ?? []) writeRuns(t, [{ text: f, bold: false }], 9.5, 0, GREY);
  return Buffer.from(await t.doc.save());
}

/** Grey "card" for demo KYC images: "DEMO – NEM VALÓDI OKMÁNY", no official layout or emblem. */
export async function demoCardPdf(fontDir: string, label: string): Promise<Buffer> {
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  const f = loadFonts(fontDir);
  const bold = await doc.embedFont(f.semibold, { subset: true });
  const reg = await doc.embedFont(f.regular, { subset: true });
  const page = doc.addPage([340, 214]);
  page.drawRectangle({ x: 0, y: 0, width: 340, height: 214, color: rgb(0.86, 0.88, 0.91) });
  page.drawRectangle({ x: 14, y: 14, width: 312, height: 186, borderColor: rgb(0.6, 0.63, 0.68), borderWidth: 1 });
  page.drawText('DEMO – NEM VALÓDI OKMÁNY', { x: 30, y: 150, size: 16, font: bold, color: RED });
  page.drawText(label, { x: 30, y: 120, size: 12, font: reg, color: INK });
  page.drawText('Kitalált bemutató adat', { x: 30, y: 40, size: 9, font: reg, color: GREY });
  return Buffer.from(await doc.save());
}
