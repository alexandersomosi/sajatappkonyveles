#!/usr/bin/env node
// Adózz.hu v2 – a Fluent-ikonok közepének mérése Chrome getBBox()-szal (KOZEPRE, ALAP-D / D1).
// Mind a 45 ikont kirajzolja a GENERÁLT adatból (ikon/emoji-adat.ts), kétszer: az eredeti '0 0 32 32' viewBoxszal
// és a KOZEPRE-javítottal, és megméri, mennyivel tér el a rajz befoglaló dobozának közepe a mező közepétől.
// Kimenet: ikon/kozep-meres.json (a teszt ezzel veti össze a saját, böngésző nélküli számítását).
// A régi scratchpad/ikon_bbox.cjs és a dizajn/landing_v2_proba4/_eszkoz/epit.cjs mérésének utódja.
//
// Futtatás: node kod/shared/v2/scripts/meres-kozep.mjs
// Kell: kod/panel/node_modules/puppeteer-core és egy helyi Chrome (csak olvas, semmit nem tölt le).
import { createRequire } from 'node:module';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EMOJI_ADAT, EMOJI_NEVEK } from '../ikon/emoji-adat.ts';
import { KOZEPRE, KOZEPRE_KUSZOB } from '../ikon/kozepre.ts';

const ITT = dirname(fileURLToPath(import.meta.url));
const V2 = resolve(ITT, '..');
const require = createRequire(import.meta.url);
const puppeteer = require(resolve(V2, '../../panel/node_modules/puppeteer-core'));
const CHROME = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((f) => existsSync(f));
if (!CHROME) throw new Error('Nem találok helyi Chrome-ot');

const svgTest = (adat) => adat.elemek.map((e) => (e.t === 'p'
  ? `<path d="${e.d}" fill="${e.f}"${e.eo ? ' fill-rule="evenodd"' : ''}/>`
  : `<rect x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" rx="${e.rx}" fill="${e.f}"/>`)).join('');

const bemenet = EMOJI_NEVEK.map((n) => ({ n, test: svgTest(EMOJI_ADAT[n]), javitott: EMOJI_ADAT[n].vb }));

const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
try {
  const p = await b.newPage();
  await p.setContent('<!doctype html><html><body></body></html>');
  const eredmeny = await p.evaluate((bemenet) => {
    const mer = (vb, test) => {
      const d = document.createElement('div');
      d.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="320" height="320"><g>${test}</g></svg>`;
      document.body.appendChild(d);
      const bb = d.querySelector('g').getBBox();
      const [x, y, w, h] = vb.split(' ').map(Number);
      const r = {
        bb: [bb.x, bb.y, bb.width, bb.height].map((v) => +v.toFixed(3)),
        dx: +((bb.x + bb.width / 2) - (x + w / 2)).toFixed(3),
        dy: +((bb.y + bb.height / 2) - (y + h / 2)).toFixed(3),
      };
      d.remove();
      return r;
    };
    return bemenet.map(({ n, test, javitott }) => {
      const e = mer('0 0 32 32', test);
      const j = mer(javitott, test);
      return { n, bb: e.bb, eredeti: { dx: e.dx, dy: e.dy }, javitott: { vb: javitott, dx: j.dx, dy: j.dy } };
    });
  }, bemenet);

  const ki = {
    _megj: 'GENERÁLT: node kod/shared/v2/scripts/meres-kozep.mjs (Chrome getBBox). bb = [x, y, szélesség, magasság] a 32×32-es mezőn; '
      + 'dx/dy = a rajz közepe mínusz a mező közepe, egységben. Kézzel ne írd.',
    kuszob: KOZEPRE_KUSZOB,
    meres: Object.fromEntries(eredmeny.map((r) => [r.n, { bb: r.bb, eredeti: r.eredeti, javitott: r.javitott }])),
  };
  // soronként egy ikon, hogy a változás a diffben olvasható legyen
  const sorok = Object.entries(ki.meres).map(([n, m]) => `    ${JSON.stringify(n)}: ${JSON.stringify(m)}`);
  writeFileSync(join(V2, 'ikon/kozep-meres.json'),
    `{\n  "_megj": ${JSON.stringify(ki._megj)},\n  "kuszob": ${ki.kuszob},\n  "meres": {\n${sorok.join(',\n')}\n  }\n}\n`);

  let hiba = 0;
  for (const r of eredmeny) {
    const eredetiMax = Math.max(Math.abs(r.eredeti.dx), Math.abs(r.eredeti.dy));
    const javMax = Math.max(Math.abs(r.javitott.dx), Math.abs(r.javitott.dy));
    const jel = KOZEPRE[r.n] ? 'KOZEPRE' : '';
    if (eredetiMax >= KOZEPRE_KUSZOB || jel) console.log(`${r.n.padEnd(12)} eredeti dx ${r.eredeti.dx} dy ${r.eredeti.dy} → javított dx ${r.javitott.dx} dy ${r.javitott.dy} ${jel}`);
    if (javMax >= 1) { console.error(`HIBA: ${r.n} javított eltérése ${javMax} ≥ 1`); hiba++; }
    if (eredetiMax >= KOZEPRE_KUSZOB && !KOZEPRE[r.n]) { console.error(`HIÁNYZIK a KOZEPRE-ből: ${r.n} (${eredetiMax})`); hiba++; }
  }
  console.log(`mérve: ${eredmeny.length} ikon → ikon/kozep-meres.json`);
  if (hiba) process.exitCode = 1;
} finally {
  await b.close();
}
