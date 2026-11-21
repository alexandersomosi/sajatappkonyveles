#!/usr/bin/env node
// Adózz.hu v2 – ikon-generátor (ALAP-D / D1, D4).
// Forrás: dizajn/C5_v2/v2.js (a jóváhagyott v2 minták ikonkészlete):
//   - `var EMOJI = {…}`  → 45 Microsoft Fluent Emoji Flat rajz (MIT)            → ikon/emoji-adat.ts
//   - `var P = {…}`      → Material Icons útvonalak (Apache-2.0), ami nem emoji  → ikon/material.ts
//   - `var EGYEDI = {…}` → a színes Google „G” és a saját „chev” nyíl            → ikon/material.ts
// + ikon/kozepre.ts (KOZEPRE viewBox-eltolás) → a viewBox már javítva kerül az adatba; ikon/kozepre.json (CommonJS-nek).
// Futásidőben nincs XML-elemzés: az ikon kész adatszerkezet (RN-ben `SvgXml` tilos – lassú listákban).
//
// Futtatás:  node kod/shared/v2/scripts/gen-ikonok.mjs              (megírja a fájlokat)
//            node kod/shared/v2/scripts/gen-ikonok.mjs --ellenoriz  (csak összeveti; eltérésnél 1-es kilépési kód)
// Node ≥ 22.18 / 23.6 kell (a .ts-t típuseltávolítással olvassa).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KOZEPRE } from '../ikon/kozepre.ts';

const ITT = dirname(fileURLToPath(import.meta.url));
const V2 = resolve(ITT, '..');
const FORRAS = resolve(V2, '../../../dizajn/C5_v2/v2.js');
const ELLENORIZ = process.argv.includes('--ellenoriz');

const v2js = readFileSync(FORRAS, 'utf8');

// ---------- EMOJI ----------
function emojiTerkep() {
  const i = v2js.indexOf('var EMOJI = ');
  if (i < 0) throw new Error('A v2.js-ben nincs „var EMOJI = ” sor');
  const j = v2js.indexOf('\n', i);
  const t = v2js.slice(i + 12, j).trim().replace(/;$/, '');
  return JSON.parse(t);
}

function attrok(s) {
  const o = {};
  for (const m of s.matchAll(/([a-zA-Z:-]+)="([^"]*)"/g)) o[m[1]] = m[2];
  return o;
}

const NEVES_SZIN = { white: '#FFFFFF', black: '#000000' };
function szin(f, hol) {
  if (NEVES_SZIN[f]) return NEVES_SZIN[f];
  if (/^#[0-9a-fA-F]{6}$/.test(f)) return f.toUpperCase();
  if (/^#[0-9a-fA-F]{3}$/.test(f)) return ('#' + f.slice(1).split('').map((c) => c + c).join('')).toUpperCase();
  throw new Error(`Ismeretlen szín (${hol}): ${f}`);
}

function szam(v, hol) {
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`Nem szám (${hol}): ${v}`);
  return n;
}

function elemzes(nev, test) {
  const elemek = [];
  let maradek = test;
  const re = /<(path|rect)\b([^>]*?)\s*(?:\/>|><\/\1>)/g;
  for (const m of test.matchAll(re)) {
    const a = attrok(m[2]);
    const hol = `${nev} ${m[1]}`;
    if (m[1] === 'path') {
      for (const k of Object.keys(a)) if (!['d', 'fill', 'fill-rule', 'clip-rule'].includes(k)) throw new Error(`Váratlan attribútum (${hol}): ${k}`);
      if (!a.d) throw new Error(`Üres útvonal (${hol})`);
      if (a['fill-rule'] && a['fill-rule'] !== 'evenodd') throw new Error(`fill-rule (${hol}): ${a['fill-rule']}`);
      // clip-rule csak <clipPath>-on belül hat – itt nincs ilyen, ezért elhagyható.
      const e = { t: 'p', d: a.d.trim(), f: szin(a.fill ?? '#000000', hol) };
      if (a['fill-rule'] === 'evenodd') e.eo = true;
      elemek.push(e);
    } else {
      for (const k of Object.keys(a)) if (!['x', 'y', 'width', 'height', 'rx', 'fill'].includes(k)) throw new Error(`Váratlan attribútum (${hol}): ${k}`);
      elemek.push({ t: 'r', x: szam(a.x ?? 0, hol), y: szam(a.y ?? 0, hol), w: szam(a.width, hol), h: szam(a.height, hol), rx: szam(a.rx ?? 0, hol), f: szin(a.fill ?? '#000000', hol) });
    }
    maradek = maradek.replace(m[0], '');
  }
  if (maradek.trim()) throw new Error(`Nem kezelt jelölés (${nev}): ${maradek.slice(0, 80)}`);
  return elemek;
}

// CSS grayscale(1): L = 0.2126 R + 0.7152 G + 0.0722 B (sRGB értékeken), brightness(3): ×3, 255-re vágva.
function szurke(hex, fenyero = 1) {
  const r = parseInt(hex.slice(1, 3), 16), g = parseInt(hex.slice(3, 5), 16), b = parseInt(hex.slice(5, 7), 16);
  const l = Math.min(255, Math.round((0.2126 * r + 0.7152 * g + 0.0722 * b) * fenyero));
  const h = l.toString(16).padStart(2, '0').toUpperCase();
  return `#${h}${h}${h}`;
}

const EMOJI = emojiTerkep();
const emojiNevek = Object.keys(EMOJI);
const emojiAdat = {};
const szinek = new Set();
for (const n of emojiNevek) {
  const [vb, test] = EMOJI[n];
  if (vb !== '0 0 32 32') throw new Error(`Váratlan viewBox (${n}): ${vb}`);
  const elemek = elemzes(n, test);
  elemek.forEach((e) => szinek.add(e.f));
  emojiAdat[n] = { vb: KOZEPRE[n] ?? vb, elemek };
}
for (const k of Object.keys(KOZEPRE)) if (!EMOJI[k]) throw new Error(`KOZEPRE: nincs ilyen ikon: ${k}`);

const S = (v) => JSON.stringify(v);
const elemTs = (e) => (e.t === 'p'
  ? `{ t: 'p', d: ${S(e.d)}, f: ${S(e.f)}${e.eo ? ', eo: true' : ''} }`
  : `{ t: 'r', x: ${e.x}, y: ${e.y}, w: ${e.w}, h: ${e.h}, rx: ${e.rx}, f: ${S(e.f)} }`);

const FEJ = (mi, kozepre = false) => `// GENERÁLT – kézzel ne írd. Forrás: dizajn/C5_v2/v2.js (${mi})${kozepre ? ' + ikon/kozepre.ts' : ''}.
// Újragenerálás: node kod/shared/v2/scripts/gen-ikonok.mjs
/* eslint-disable */
`;

const rendezettSzinek = [...szinek].sort();
let emojiTs = FEJ('EMOJI – Microsoft Fluent Emoji Flat, MIT', true) + `import type { IkonAdat } from './tipusok';

/** A 45 tartalmi ikon neve (a v2.js EMOJI térkép sorrendjében). */
export const EMOJI_NEVEK = ${S(emojiNevek).replace(/","/g, '", "')} as const;
export type EmojiNev = (typeof EMOJI_NEVEK)[number];

/** A rajzok. A viewBox a KOZEPRE-javítással (ikon/kozepre.ts) együtt. */
export const EMOJI_ADAT: Readonly<Record<EmojiNev, IkonAdat>> = {
`;
for (const n of emojiNevek) {
  emojiTs += `  ${S(n)}: { vb: ${S(emojiAdat[n].vb)}, elemek: [\n`;
  for (const e of emojiAdat[n].elemek) emojiTs += `    ${elemTs(e)},\n`;
  emojiTs += `  ] },\n`;
}
emojiTs += `};

/** Szürke változat (CSS grayscale(1) – beviteli mezőben): eredeti szín → szürke. */
export const SZURKE_TABLA: Readonly<Record<string, string>> = {
${rendezettSzinek.map((c) => `  ${S(c)}: ${S(szurke(c))},`).join('\n')}
};

/** Világos változat (CSS grayscale(1) brightness(3) – a kék fejléc háttérrajza): eredeti szín → világosszürke/fehér. */
export const VILAGOS_TABLA: Readonly<Record<string, string>> = {
${rendezettSzinek.map((c) => `  ${S(c)}: ${S(szurke(c, 3))},`).join('\n')}
};
`;

// ---------- Material (P) + EGYEDI (google, chev) ----------
function blokk(nev) {
  const i = v2js.indexOf(`var ${nev} = {`);
  if (i < 0) throw new Error(`A v2.js-ben nincs „var ${nev} = {”`);
  const j = v2js.indexOf('\n  };', i);
  return v2js.slice(i, j);
}
const P = {};
for (const m of blokk('P').matchAll(/^\s*'([a-z-]+)':\s*'([^']+)'/gm)) P[m[1]] = m[2];
const EGYEDI = {};
for (const m of blokk('EGYEDI').matchAll(/^\s*'([a-z-]+)':\s*'(.+)',?\s*$/gm)) EGYEDI[m[1]] = m[2].replace(/',?$/, '');

// A v2.js P táblájából az, ami nem emoji (a mintákban ezek a kezelőelemek).
const P_VEZERLO = Object.keys(P).filter((k) => !EMOJI[k]);
// A képernyőkhöz kellő, a v2.js-ből hiányzó vezérlők: Material Icons (baseline, 24 px) útvonalak – Apache-2.0.
const KIEGESZITES = {
  masol: { d: 'M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z', forras: 'content_copy' },
  kulso: { d: 'M19 19H5V5h7V3H5c-1.11 0-2 .9-2 2v14c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2v-7h-2v7zM14 3v2h3.59l-9.83 9.83 1.41 1.41L19 6.41V10h2V3h-7z', forras: 'open_in_new' },
  frissit: { d: 'M17.65 6.35C16.2 4.9 14.21 4 12 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08c-.82 2.33-3.04 4-5.65 4-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z', forras: 'refresh' },
  szuro: { d: 'M10 18h4v-2h-4v2zM3 6v2h18V6H3zm3 7h12v-2H6v2z', forras: 'filter_list' },
  tobb: { d: 'M6 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm12 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm-6 0c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z', forras: 'more_horiz' },
};
// A saját „chev” nyíl (EGYEDI, körvonalas) és elforgatott társai (lenyíló, vissza-lapozás) – ugyanaz a vonal.
const chevA = attrok(EGYEDI.chev);
const CHEV_VONAL = szam(chevA['stroke-width'], 'chev');
const CHEVEK = {
  chev: chevA.d,
  'chev-le': 'M5.5 9l6.5 6.5L18.5 9',
  'chev-fel': 'M5.5 15l6.5-6.5L18.5 15',
  'chev-bal': 'M15 5.5L8.5 12l6.5 6.5',
};

const vezerlo = {};
for (const k of P_VEZERLO) vezerlo[k] = { d: P[k], megj: `Material Icons (v2.js P)` };
for (const [k, d] of Object.entries(CHEVEK)) vezerlo[k] = { d, vonal: CHEV_VONAL, megj: k === 'chev' ? 'saját (v2.js EGYEDI)' : 'saját, a chev elforgatva' };
for (const [k, v] of Object.entries(KIEGESZITES)) vezerlo[k] = { d: v.d, megj: `Material Icons: ${v.forras}` };
const vezerloNevek = Object.keys(vezerlo);

const google = elemzes('google', EGYEDI.google);

let matTs = FEJ('P, EGYEDI – Material Icons, Apache-2.0; saját chev') + `import type { IkonAdat, VezerloAdat } from './tipusok';

/** Egyszínű vezérlő-ikonok (24×24). A szín a hívótól jön (webes currentColor / RN \`szin\`). */
export const VEZERLO_NEVEK = ${S(vezerloNevek).replace(/","/g, '", "')} as const;
export type VezerloNev = (typeof VEZERLO_NEVEK)[number];

export const VEZERLO_VB = '0 0 24 24';

export const VEZERLO_ADAT: Readonly<Record<VezerloNev, VezerloAdat>> = {
${vezerloNevek.map((k) => `  ${S(k)}: { d: ${S(vezerlo[k].d)}${vezerlo[k].vonal ? `, vonal: ${vezerlo[k].vonal}` : ''} }, // ${vezerlo[k].megj}`).join('\n')}
};

/** A színes Google „G” (a Google-gombhoz; a márka színei nem változtathatók). */
export const GOOGLE_G: IkonAdat = { vb: '0 0 24 24', elemek: [
${google.map((e) => `  ${elemTs(e)},`).join('\n')}
] };
`;

const kozepreJson = JSON.stringify({ _megj: 'GENERÁLT a kod/shared/v2/ikon/kozepre.ts-ből (gen-ikonok.mjs). Kézzel ne írd.', ...KOZEPRE }, null, 2) + '\n';

// ---------- kiírás / ellenőrzés ----------
const KIMENET = [
  [join(V2, 'ikon/emoji-adat.ts'), emojiTs],
  [join(V2, 'ikon/material.ts'), matTs],
  [join(V2, 'ikon/kozepre.json'), kozepreJson],
];
let elter = 0;
for (const [f, tartalom] of KIMENET) {
  if (ELLENORIZ) {
    const most = existsSync(f) ? readFileSync(f, 'utf8') : '';
    if (most !== tartalom) { console.error(`ELTÉR: ${f}`); elter++; }
  } else {
    writeFileSync(f, tartalom);
  }
}
if (ELLENORIZ) {
  if (elter) process.exit(1);
  console.log('gen-ikonok: a generált fájlok naprakészek');
} else {
  console.log(`gen-ikonok: ${emojiNevek.length} emoji, ${vezerloNevek.length} vezérlő, ${rendezettSzinek.length} szín, KOZEPRE: ${Object.keys(KOZEPRE).length}`);
}
