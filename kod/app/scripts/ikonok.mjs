#!/usr/bin/env node
// Csak az app-ikonok újrarajzolása a brand.json nevének kezdőbetűjével (11-19 integrátor, átnevezés „Adózz”-ra).
// Ugyanaz a rajz, mint a scripts/eszkozok.mjs 6) pontjában (lapos #1428DB négyzet, Geist Black betű, #C9D2FF kézvonás),
// de a többi képelemhez (3D ikonok, tárgyképek, textúra) nem nyúl. Futtatás: node scripts/ikonok.mjs
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const here = dirname(fileURLToPath(import.meta.url));
const app = resolve(here, '..');
const diz = resolve(app, '../../dizajn/C2_modern');
const out = join(app, 'assets');
const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const brand = JSON.parse(readFileSync(join(app, '../shared/brand.json'), 'utf8'));
const betu = String(brand.name).trim().charAt(0).toLocaleUpperCase('hu-HU').replace(/[<&>]/g, '');
const kvIkon = /ikon:\s*"([^"]+)"/.exec(readFileSync(join(diz, 'app_v2/kozos.js'), 'utf8'))?.[1];
if (!kvIkon) throw new Error('a kézvonás útvonala nem található (dizajn/C2_modern/app_v2/kozos.js)');
const per = (p) => p.split('\\').join('/');
const geist = per(join(diz, 'app_v2/fontok/Geist_wght.ttf'));
const tmp = join(tmpdir(), `adozz_ikonok_${process.pid}`);
mkdirSync(tmp, { recursive: true });
let n = 0;
function render(html, w, h, target) {
  const page = join(tmp, `p${n}.html`);
  const prof = join(tmp, `profil_${n++}`);
  writeFileSync(page, `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face{font-family:Geist;src:url("file:///${geist}") format("truetype");font-weight:100 900}
    html,body{margin:0;padding:0;background:transparent;width:${w}px;height:${h}px;overflow:hidden}
  </style></head><body>${html}</body></html>`);
  execFileSync(chrome, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check',
    `--user-data-dir=${prof}`, `--window-size=${w},${h}`, '--force-device-scale-factor=1', '--default-background-color=00000000',
    '--virtual-time-budget=3000', `--screenshot=${per(target)}`, 'file:///' + per(page)], { stdio: 'ignore' });
  try { rmSync(prof, { recursive: true, force: true }); } catch {}
  if (!existsSync(target)) throw new Error('nem készült el: ' + target);
}
const ikonSvg = (bg, r, px) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120" width="${px}" height="${px}" style="display:block">
  ${bg ? `<rect width="120" height="120" rx="${r}" fill="#1428DB"/>` : ''}
  <text x="60" y="83" text-anchor="middle" fill="#fff" style="font-family:Geist;font-weight:900;font-size:76px;letter-spacing:-.02em">${betu}</text>
  <path d="${kvIkon}" fill="#C9D2FF"/></svg>`;
render(ikonSvg(true, 0, 1024), 1024, 1024, join(out, 'icon.png'));
render(`<div style="width:1024px;height:1024px;display:flex;align-items:center;justify-content:center"><div style="width:640px;height:640px">${ikonSvg(false, 0, 640)}</div></div>`,
  1024, 1024, join(out, 'android-ikon-eloter.png'));
render(ikonSvg(true, 27, 48), 48, 48, join(out, 'favicon.png'));
render(ikonSvg(false, 0, 400), 400, 400, join(out, 'splash-ikon.png'));
try { rmSync(tmp, { recursive: true, force: true }); } catch {}
console.log(`ikonok kész („${betu}”): icon.png, android-ikon-eloter.png, favicon.png, splash-ikon.png`);
