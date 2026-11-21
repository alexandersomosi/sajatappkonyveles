#!/usr/bin/env node
// Adózz.hu v2 – ikon-katalógus szemrevételezéshez (ALAP-D / D3): minta/ikonok.html (+ --kep: minta/ikonok.png).
// Minden tartalmi ikon csempében (kicsi 36/29, alap 42/34, nagy 64/50), szürke és világos változatban, a vezérlő-ikonok,
// a színek és a logó – ugyanabból az adatból, amiből az app és a panel rajzol. A „középvonal” kapcsolóval a csempe
// közepére húzott segédvonalak mutatják, hogy a rajz középen ül-e (KOZEPRE).
// Futtatás: node kod/shared/v2/scripts/gen-minta.mjs [--kep]   (--kep: helyi Chrome + kod/panel/node_modules/puppeteer-core)
import { createRequire } from 'node:module';
import { existsSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { EMOJI_ADAT, EMOJI_NEVEK, SZURKE_TABLA, VILAGOS_TABLA } from '../ikon/emoji-adat.ts';
import { VEZERLO_ADAT, VEZERLO_NEVEK, VEZERLO_VB, GOOGLE_G } from '../ikon/material.ts';
import { KOZEPRE } from '../ikon/kozepre.ts';
import { szin, csempe, arnyek, fejGradiens } from '../tokenek.ts';
import { logoMeret } from '../logo/meret.ts';

const V2 = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

function svg(adat, pt, tabla) {
  const f = (c) => (tabla ? tabla[c] ?? c : c);
  return `<svg viewBox="${adat.vb}" width="${pt}" height="${pt}" aria-hidden="true" focusable="false">${adat.elemek.map((e) => (e.t === 'p'
    ? `<path d="${e.d}" fill="${f(e.f)}"${e.eo ? ' fill-rule="evenodd"' : ''}/>`
    : `<rect x="${e.x}" y="${e.y}" width="${e.w}" height="${e.h}" rx="${e.rx}" fill="${f(e.f)}"/>`)).join('')}</svg>`;
}
const vez = (n, pt = 24, c = szin.sotet) => {
  const a = VEZERLO_ADAT[n];
  return `<svg viewBox="${VEZERLO_VB}" width="${pt}" height="${pt}" aria-hidden="true" focusable="false">${a.vonal
    ? `<path d="${a.d}" fill="none" stroke="${c}" stroke-width="${a.vonal}" stroke-linecap="round" stroke-linejoin="round"/>`
    : `<path d="${a.d}" fill="${c}"/>`}</svg>`;
};
const cs = (n, m) => `<span class="cs" style="width:${csempe[m].meret}px;height:${csempe[m].meret}px;border-radius:${csempe[m].sugar}px">${svg(EMOJI_ADAT[n], csempe[m].ikon)}</span>`;

const kartyak = EMOJI_NEVEK.map((n) => `<div class="k">
  <div class="sor">${cs(n, 'kicsi')}${cs(n, 'alap')}${cs(n, 'nagy')}</div>
  <div class="sor masod"><span class="mezo">${svg(EMOJI_ADAT[n], 20, SZURKE_TABLA)}</span><span class="fej">${svg(EMOJI_ADAT[n], 34, VILAGOS_TABLA)}</span></div>
  <b>${esc(n)}</b>${KOZEPRE[n] ? `<small>KOZEPRE: ${esc(KOZEPRE[n])}</small>` : '<small>&nbsp;</small>'}
</div>`).join('\n');

const vezerlok = VEZERLO_NEVEK.map((n) => `<div class="v">${vez(n)}<span>${esc(n)}</span></div>`).join('')
  + `<div class="v">${svg(GOOGLE_G, 24)}<span>GOOGLE_G</span></div>`;
const szinek = Object.entries(szin).map(([k, v]) => `<div class="sz"><i style="background:${v}"></i><span>${esc(k)}<br><code>${v}</code></span></div>`).join('');
const lk = logoMeret(30), lf = logoMeret(30, true);

const html = `<!doctype html>
<html lang="hu"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>v2 ikon-katalógus</title>
<!-- GENERÁLT: node kod/shared/v2/scripts/gen-minta.mjs – kézzel ne írd. Csak szemrevételezéshez, nem megy ki. -->
<style>
  body { margin: 0; padding: 24px; background: ${szin.hatter}; color: ${szin.sotet}; font: 15px/1.45 "Segoe UI", Arial, sans-serif; }
  h1 { font-size: 22px; margin: 0 0 4px; } h2 { font-size: 14px; letter-spacing: .04em; text-transform: uppercase; color: ${szin.szurke}; margin: 26px 0 10px; }
  p { margin: 0 0 12px; color: ${szin.szurke}; max-width: 900px; }
  .racs { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
  .k { background: #fff; border-radius: 20px; padding: 14px; box-shadow: ${arnyek.kartya.css}; }
  .k b { display: block; margin-top: 8px; } .k small { color: ${szin.szurke}; }
  .sor { display: flex; align-items: center; gap: 10px; } .sor.masod { margin-top: 10px; }
  .cs { display: grid; place-items: center; background: ${csempe.hatter}; position: relative; flex: none; }
  .cs svg { display: block; }
  .kozep .cs::before, .kozep .cs::after { content: ""; position: absolute; background: rgba(229,72,77,.55); pointer-events: none; }
  .kozep .cs::before { left: 50%; top: 0; bottom: 0; width: 1px; } .kozep .cs::after { top: 50%; left: 0; right: 0; height: 1px; }
  .mezo { display: inline-flex; align-items: center; height: 40px; padding: 0 10px; border: 1.5px solid ${szin.keret}; border-radius: 12px; background: #fff; }
  .mezo svg { opacity: .6; }
  .fej { display: inline-grid; place-items: center; width: 52px; height: 40px; border-radius: 12px; background: ${fejGradiens.css}; }
  .fej svg { opacity: .16; }
  .vez { display: flex; flex-wrap: wrap; gap: 10px; } .v { display: flex; align-items: center; gap: 8px; background: #fff; border-radius: 14px; padding: 8px 12px; box-shadow: ${arnyek.kartya.css}; }
  .szinek { display: grid; grid-template-columns: repeat(auto-fill, minmax(170px, 1fr)); gap: 8px; }
  .sz { display: flex; gap: 8px; align-items: center; background: #fff; border-radius: 12px; padding: 8px; font-size: 13px; }
  .sz i { width: 32px; height: 32px; border-radius: 8px; border: 1px solid ${szin.vonal}; flex: none; }
  .logok { display: flex; gap: 16px; align-items: center; } .logok .kek { background: ${fejGradiens.css}; padding: 12px 16px; border-radius: 14px; }
  label { display: inline-flex; gap: 6px; align-items: center; margin-bottom: 12px; }
</style></head>
<body class="kozep">
<h1>Adózz.hu v2 – ikon-katalógus</h1>
<p>${EMOJI_NEVEK.length} tartalmi ikon (Microsoft Fluent Emoji Flat, MIT) semleges csempén – kicsi 36/29, alap 42/34, nagy 64/50 –, alattuk a szürke (mezőben) és a világos (kék fejléc háttérrajza) változat; ${VEZERLO_NEVEK.length} vezérlő-ikon (Material Icons, Apache-2.0 + saját nyíl). A piros segédvonal a csempe közepe.</p>
<label><input type="checkbox" checked onchange="document.body.classList.toggle('kozep', this.checked)"> középvonal</label>
<h2>Tartalmi ikonok</h2>
<div class="racs">
${kartyak}
</div>
<h2>Vezérlő-ikonok</h2>
<div class="vez">${vezerlok}</div>
<h2>Logó</h2>
<div class="logok"><img src="../logo/logo.png" width="${lk.width}" height="${lk.height}" alt="Adózz.hu"><span class="kek"><img src="../logo/logo_feher.png" width="${lf.width}" height="${lf.height}" alt="Adózz.hu"></span></div>
<h2>Színek (tokenek.ts → szin)</h2>
<div class="szinek">${szinek}</div>
</body></html>
`;
const CEL = join(V2, 'minta/ikonok.html');
writeFileSync(CEL, html);
console.log('minta/ikonok.html kész');

if (process.argv.includes('--kep')) {
  const require = createRequire(import.meta.url);
  const puppeteer = require(resolve(V2, '../../panel/node_modules/puppeteer-core'));
  const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find((f) => existsSync(f));
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new' });
  try {
    const p = await b.newPage();
    await p.setViewport({ width: 1280, height: 900, deviceScaleFactor: 1 });
    await p.goto('file:///' + CEL.replace(/\\/g, '/'), { waitUntil: 'load' });
    await p.screenshot({ path: join(V2, 'minta/ikonok.png'), fullPage: true });
    console.log('minta/ikonok.png kész');
  } finally {
    await b.close();
  }
}
