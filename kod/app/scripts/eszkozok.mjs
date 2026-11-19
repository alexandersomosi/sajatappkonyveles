#!/usr/bin/env node
// Képelemek a jóváhagyott C2 dizájnból (dizajn/C2_modern) az app assets/ mappájába.
// - 3D ikonok, rajzolt Bence, tárgyképek, papírtextúra: másolás (@2x/@3x, a Metro választ sűrűség szerint)
// - SVG-k (guilloche-rozetta, üres mappa, minta nyugta) és az app-ikon: raszterezés fej nélküli Chrome-mal (átlátszó háttér)
// - az aláírás és a kézvonás útvonalai: src/theme/utak.ts (GENERÁLT)
// Futtatás: node scripts/eszkozok.mjs   (internet nem kell; Chrome: CHROME env vagy az alapértelmezett helye)
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const app = resolve(here, '..');
const diz = resolve(app, '../../dizajn/C2_modern');
const out = join(app, 'assets');
const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';

function mk(d) { mkdirSync(d, { recursive: true }); return d; }
function cp(from, to) { mk(dirname(to)); copyFileSync(from, to); }

// 1) 3D ikonok – minden @2x/@3x (az előnézet, a nyers és az info nem kell)
const ik = join(diz, 'assets/ikon3d');
let n = 0;
for (const f of readdirSync(ik)) {
  if (/@[23]x\.png$/.test(f)) { cp(join(ik, f), join(out, 'ikon3d', f)); n++; }
}
console.log(`ikon3d: ${n} fájl`);

// 2) Bence: a rajzolt karakter (lapos)
for (const s of ['@2x', '@3x']) cp(join(diz, `assets/avatar/karakter_1_lapos${s}.png`), join(out, 'avatar', `karakter_1_lapos${s}.png`));
// a nagy (380 px) forrás: 56 pt fölötti arcképhez (06 Üzenetek: 60 pt) és 3×-os webes kijelzőhöz – csak lefelé méretezünk
cp(join(diz, 'assets/avatar/karakter_1_lapos_nagy.png'), join(out, 'avatar', 'karakter_1_lapos_nagy.png'));

// 3) tárgyképek (160 × 120 pt-os doboz) + a 3D tépőnaptár
const il = join(diz, 'assets/illusztraciok');
for (const f of readdirSync(il)) {
  if (/@[23]x\.png$/.test(f)) cp(join(il, f), join(out, 'illusztraciok', f));
}

// 4) papírszál-textúra a levélhez
cp(join(diz, 'assets/textura/papirszal_halk_csempe.png'), join(out, 'textura', 'papirszal@2x.png'));

// 5) útvonalak: aláírás (Bence, HELYŐRZŐ) és a kézvonás (ikon + szóvédjegy)
const utak = readFileSync(join(diz, 'app_v2/kezjegy_utak.js'), 'utf8');
const kozos = readFileSync(join(diz, 'app_v2/kozos.js'), 'utf8');
const alairas = /alairas:\s*"([^"]+)"/.exec(utak)?.[1];
const kvIkon = /ikon:\s*"([^"]+)"/.exec(kozos)?.[1];
const kvSzojegy = /szojegy:\s*"([^"]+)"/.exec(kozos)?.[1];
if (!alairas || !kvIkon || !kvSzojegy) throw new Error('útvonal nem található a dizájnfájlokban');
mk(join(app, 'src/theme'));
writeFileSync(join(app, 'src/theme/utak.ts'),
  '// GENERÁLT: scripts/eszkozok.mjs a dizajn/C2_modern/app_v2 kezjegy_utak.js és kozos.js fájlából. Kézzel ne írd.\n' +
  '// A DEMO aláírás HELYŐRZŐ: élesben a könyvelő saját aláírása jön az API-ból (accountant.signatureSvgPath).\n' +
  `export const DEMO_ALAIRAS = ${JSON.stringify(alairas)}; // viewBox 0 0 210 78\n` +
  `export const KEZVONAS_IKON = ${JSON.stringify(kvIkon)}; // viewBox 0 0 120 120\n` +
  `export const KEZVONAS_SZOJEGY = ${JSON.stringify(kvSzojegy)}; // viewBox 0 0 220 26\n`);

// 6) raszterezés Chrome-mal
const geist = join(diz, 'app_v2/fontok/Geist_wght.ttf').replace(/\\/g, '/');
const tmp = mk(join(tmpdir(), 'kezjegy_eszkozok'));
let shot = 0;
function render(html, w, h, scale, target) {
  const page = join(tmp, `p${shot}.html`);
  const prof = join(tmp, `profil_${process.pid}_${shot++}`);
  writeFileSync(page, `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face{font-family:Geist;src:url("file:///${geist}") format("truetype");font-weight:100 900}
    html,body{margin:0;padding:0;background:transparent;width:${w}px;height:${h}px;overflow:hidden}
  </style></head><body>${html}</body></html>`);
  mk(dirname(target));
  execFileSync(chrome, [
    '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    `--user-data-dir=${prof}`, `--window-size=${w},${h}`, `--force-device-scale-factor=${scale}`,
    '--default-background-color=00000000', '--virtual-time-budget=3000',
    `--screenshot=${target.replace(/\\/g, '/')}`, 'file:///' + page.replace(/\\/g, '/'),
  ], { stdio: 'ignore' });
  try { rmSync(prof, { recursive: true, force: true }); } catch {}
  if (!existsSync(target)) throw new Error('nem készült el: ' + target);
}
const svgFile = (p) => readFileSync(join(diz, p), 'utf8').replace(/<\?xml[^>]*>/, '');
const fit = (svg, w, h) => svg.replace(/<svg([^>]*?)\swidth="[^"]*"/, '<svg$1').replace(/<svg([^>]*?)\sheight="[^"]*"/, '<svg$1')
  .replace('<svg', `<svg width="${w}" height="${h}" style="display:block"`);

// guilloche-rozetta (440 × 440 pt)
const roz = fit(svgFile('app_v2/guilloche_rozetta.svg'), 440, 440);
render(roz, 440, 440, 2, join(out, 'textura/rozetta@2x.png'));
render(roz, 440, 440, 3, join(out, 'textura/rozetta@3x.png'));
// üres mappa (11) – a hónap valódi szöveg lesz rajta az appban
const mappa = fit(svgFile('app_v2/illusztraciok/ures_mappa.svg'), 160, 120);
render(mappa, 160, 120, 2, join(out, 'illusztraciok/ures_mappa@2x.png'));
render(mappa, 160, 120, 3, join(out, 'illusztraciok/ures_mappa@3x.png'));
// MINTA nyugtafotó (csak a minta/demó módhoz: tétel-előnézet és kamera-előnézet)
const nyugta = fit(svgFile('app_v2/nyugta_foto_keretben.svg'), 358, 254);
render(nyugta, 358, 254, 2, join(out, 'minta/nyugta_keretben.png'));
const nyugta2 = fit(svgFile('app_v2/nyugta_foto.svg'), 358, 214);
render(nyugta2, 358, 214, 2, join(out, 'minta/nyugta.png'));

// app-ikon: lapos márkakék (#1428DB, a tulaj 11-18 17:50-es döntése) négyzet, Geist Black kezdőbetű, alatta a kézvonás (#C9D2FF) – kozos.js #appikon
// A betű a brand.json nevének első betűje (11-19: „Adózz” → A; csak az ikonok: scripts/ikonok.mjs).
const KEZDOBETU = JSON.parse(readFileSync(join(app, '../shared/brand.json'), 'utf8')).name.trim().charAt(0).toLocaleUpperCase('hu-HU').replace(/[<&>]/g, '');
const ikonSvg = (bg, r) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="1024" height="1024" style="display:block">
  ${bg ? `<rect width="120" height="120" rx="${r}" fill="#1428DB"/>` : ''}
  <text x="60" y="83" text-anchor="middle" fill="#fff" style="font-family:Geist;font-weight:900;font-size:76px;letter-spacing:-.02em">${KEZDOBETU}</text>
  <path d="${kvIkon}" fill="#C9D2FF"/></svg>`;
render(ikonSvg(true, 0), 1024, 1024, 1, join(out, 'icon.png')); // az áruház maga kerekít
// Android adaptív ikon: előtér átlátszó, a K a biztonsági zónában (66%)
render(`<div style="width:1024px;height:1024px;display:flex;align-items:center;justify-content:center">
  <div style="width:640px;height:640px">${ikonSvg(false, 0).replace('width="1024" height="1024"', 'width="640" height="640"')}</div></div>`,
  1024, 1024, 1, join(out, 'android-ikon-eloter.png'));
render(ikonSvg(true, 27).replace('width="1024" height="1024"', 'width="48" height="48"'), 48, 48, 1, join(out, 'favicon.png'));
// indítókép: a K ikon a kék háttéren (a háttérszínt az app.config adja)
render(ikonSvg(false, 0).replace('width="1024" height="1024"', 'width="400" height="400"'), 400, 400, 1, join(out, 'splash-ikon.png'));
// 6b) alapfájl (1x név) minden @2x mellé, az @2x tartalmával: a webes export csak az alapnevet hivatkozza, és mi mindig
//     megadjuk a pt-méretet, így weben is éles marad; natívan a Metro továbbra is a sűrűség szerinti @2x/@3x-at választja.
for (const d of ['ikon3d', 'avatar', 'illusztraciok', 'textura']) {
  for (const f of readdirSync(join(out, d))) {
    const m = /^(.+)@2x\.png$/.exec(f);
    if (m) copyFileSync(join(out, d, f), join(out, d, `${m[1]}.png`));
  }
}

// 7) képjegyzék: statikus require-ok (a Metro csak így csomagol; @2x/@3x-at a sűrűség szerint választ)
const alapnevek = new Map(); // név -> pt-méretek
for (const f of readdirSync(join(out, 'ikon3d'))) {
  const m = /^(.+)_(\d+)@[23]x\.png$/.exec(f);
  if (!m) continue;
  const s = alapnevek.get(m[1]) ?? new Set();
  s.add(Number(m[2]));
  alapnevek.set(m[1], s);
}
let ts = '// GENERÁLT: scripts/eszkozok.mjs. A jóváhagyott 3D ikonok (dizajn/C2_modern/assets/ikon3d). Kézzel ne írd.\n' +
  '/* eslint-disable */\nexport const IKON3D = {\n';
for (const [nev, meretek] of [...alapnevek.entries()].sort()) {
  ts += `  ${JSON.stringify(nev)}: {\n`;
  for (const pt of [...meretek].sort((a, b) => a - b)) ts += `    ${pt}: require('../../assets/ikon3d/${nev}_${pt}.png'),\n`;
  ts += '  },\n';
}
ts += '} as const;\nexport type Ikon3dNev = keyof typeof IKON3D;\n\nexport const TARGYKEPEK = {\n';
const targyak = new Set();
for (const f of readdirSync(join(out, 'illusztraciok'))) {
  const m = /^(.+)@[23]x\.png$/.exec(f);
  if (m) targyak.add(m[1]);
}
for (const t of [...targyak].sort()) ts += `  ${JSON.stringify(t)}: require('../../assets/illusztraciok/${t}.png'),\n`;
ts += '} as const;\nexport type TargykepNev = keyof typeof TARGYKEPEK;\n';
writeFileSync(join(app, 'src/theme/kepjegyzek.ts'), ts);
console.log('kész: assets/ és src/theme/kepjegyzek.ts');
