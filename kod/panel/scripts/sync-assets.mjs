#!/usr/bin/env node
// Copies the approved design assets (SPEC §2.6–2.8, §17.2) from dizajn/C2_modern into public/a/.
// Only what the panel uses: 3D icons (all sizes, @2x/@3x), the drawn accountant character,
// the front-view illustrations, the paper/guilloche textures and the rosette SVG.
// Never deletes anything. If the design folder is missing (e.g. a build server) and public/a
// already holds the copies, it just says so and exits 0.
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const panel = resolve(here, '..');
const design = resolve(panel, '../../dizajn/C2_modern');
const out = join(panel, 'public', 'a');

if (!existsSync(design)) {
  if (existsSync(join(out, 'ikon3d'))) {
    console.log('assets: design folder not found, keeping existing public/a copies');
    process.exit(0);
  }
  console.error('assets: design folder not found and public/a is empty: ' + design);
  process.exit(1);
}

// The 16 approved icons + the spare ones the approved PNGs already use (szamlak, boritek, bevallas in 04)
// + the shadowless variants and the small "kész" seal (befizetve_jel).
const ICONS = [
  'befizetve', 'dosszie', 'ertesites', 'feltoltes', 'fiok', 'fooldal', 'fotozas', 'hataridok',
  'igazolas', 'irat', 'kerdezek', 'masolas', 'nyugta', 'szamlaszam', 'szamolo', 'uzenetek',
  'szamlak', 'boritek', 'bevallas', 'befizetve_jel',
  // SPEC §26 (ICON3D_EXTRA, approved sheet C): ora = callbacks, lakat = locked
  'ora', 'lakat',
  'irat_arnyektalan', 'nyugta_arnyektalan', 'szamolo_arnyektalan', 'ertesites_arnyektalan',
  'befizetve_arnyektalan', 'masolas_arnyektalan', 'szamlaszam_arnyektalan',
];

let n = 0;
function copy(src, dst) {
  mkdirSync(dirname(dst), { recursive: true });
  if (existsSync(dst) && statSync(dst).size === statSync(src).size && statSync(dst).mtimeMs >= statSync(src).mtimeMs) return;
  copyFileSync(src, dst);
  n++;
}

const iconDir = join(design, 'assets', 'ikon3d');
for (const f of readdirSync(iconDir)) {
  const m = f.match(/^(.+)_(\d+)@([23])x\.png$/);
  if (!m || !ICONS.includes(m[1])) continue;
  copy(join(iconDir, f), join(out, 'ikon3d', f));
}

const avatarDir = join(design, 'assets', 'avatar');
for (const f of ['karakter_1_lapos@2x.png', 'karakter_1_lapos@3x.png', 'karakter_1_lapos_nagy.png']) {
  copy(join(avatarDir, f), join(out, 'avatar', f));
}

// Only the object visuals the approved screens still use (TERV 0): the full folder (dosszie_mappa), the laptop
// (videohivas_laptop) and the stamp object (befizetve_pecset) are retired and no longer copied.
const ILLUSZTRACIOK = ['hatarido_naptar', 'level_boritek', 'meghatalmazas_alairva', 'tepnaptar_3d'];
const illDir = join(design, 'assets', 'illusztraciok');
for (const f of readdirSync(illDir)) {
  const m = f.match(/^(.+)@[23]x\.png$/);
  if (!m || !ILLUSZTRACIOK.includes(m[1])) continue;
  copy(join(illDir, f), join(out, 'illusztraciok', f));
}
// The empty folder (design 11) is rendered from app_v2/illusztraciok/ures_mappa.svg by the app's asset script.
const uresMappa = resolve(panel, '../app/assets/illusztraciok');
for (const f of ['ures_mappa@2x.png', 'ures_mappa@3x.png']) {
  if (existsSync(join(uresMappa, f))) copy(join(uresMappa, f), join(out, 'illusztraciok', f));
}

for (const f of ['papirszal_halk_csempe.png', 'guilloche_halk_csempe.png']) {
  copy(join(design, 'assets', 'textura', f), join(out, 'textura', f));
}
copy(join(design, 'app_v2', 'guilloche_rozetta.svg'), join(out, 'guilloche_rozetta.svg'));

// favicon: the approved app icon (brand-blue #1428DB square, Geist Black initial of brand.json name, blue pen stroke)
const brand = JSON.parse(readFileSync(resolve(panel, '../shared/brand.json'), 'utf8'));
const stroke = readFileSync(join(design, 'app_v2', 'kozos.js'), 'utf8').match(/ikon:\s*"([^"]+)"/)?.[1];
if (stroke) {
  const initial = String(brand.name).trim().charAt(0).toUpperCase().replace(/[<&>]/g, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" rx="27" fill="#1428DB"/>` +
    `<text x="60" y="83" text-anchor="middle" fill="#fff" font-family="Geist, Segoe UI, Arial, sans-serif" font-weight="900" font-size="76">${initial}</text>` +
    `<path d="${stroke}" fill="#C9D2FF"/></svg>`;
  writeFileSync(join(panel, 'public', 'favicon.svg'), svg);
}

console.log(`assets -> ${out} (${n} file(s) updated)`);
