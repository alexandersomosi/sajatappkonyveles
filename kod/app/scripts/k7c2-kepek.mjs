#!/usr/bin/env node
// k7c2 fix round (2026-11-20) – screenshots of the fixed client screens with the REAL backend (scripts/helyi-proba.mjs,
// PGlite + demo seed incl. seed:k29). Fake data only; no password typed (the harness' /__helyi/belep).
//   PORT=8893 node scripts/helyi-proba.mjs   (külön ablakban)
//   BASE=http://127.0.0.1:8893 node scripts/k7c2-kepek.mjs   → kod/_qa/k7c2j_*.png (390 × 844 @2x)
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(app, '../panel/package.json'));
const puppeteer = require('puppeteer-core');
const BASE = process.env.BASE || 'http://127.0.0.1:8893';
const ki = resolve(app, '..', '_qa');
mkdirSync(ki, { recursive: true });
const var_ = (ms) => new Promise((r) => setTimeout(r, ms));
const eredmeny = [];

async function kep(page, nev, opt = {}) {
  await var_(1200);
  await page.screenshot({ path: join(ki, `k7c2j_${nev}.png`), fullPage: Boolean(opt.teljes) });
  const szoveg = await page.evaluate(() => document.body.innerText.slice(0, 4000));
  eredmeny.push({ nev, ut: new URL(page.url()).pathname, szoveg });
  console.log(`kép: k7c2j_${nev}  ${new URL(page.url()).pathname}`);
}

async function futas(nev, kicsoda, lepesek) {
  const prof = join(tmpdir(), `kezjegy_k7c2j_${process.pid}_${nev}`);
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, userDataDir: prof, args: ['--no-first-run', '--hide-scrollbars'] });
  try {
    const page = await b.newPage();
    const hibak = [];
    page.on('pageerror', (e) => hibak.push(e.message));
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await page.goto(`${BASE}/__helyi/belep?ki=${encodeURIComponent(kicsoda)}&ide=/`, { waitUntil: 'networkidle0', timeout: 60_000 });
    await var_(1500);
    await lepesek(page);
    if (hibak.length) console.log(`${nev}: oldalhibák:`, hibak.slice(0, 3));
  } catch (e) {
    console.log(`${nev}: HIBA`, e.message);
    eredmeny.push({ nev, hiba: e.message });
  } finally {
    await b.close();
  }
}
const menj = async (page, ut) => {
  await page.goto(`${BASE}${ut}`, { waitUntil: 'networkidle0', timeout: 60_000 });
  await var_(1500);
};

// 1. Kerekes Anna – a havidíj megerősítésre vár: Főoldal + Fizesd ki
await futas('anna', 'auth+anna', async (p) => {
  await kep(p, '01_anna_fooldal');
  await menj(p, '/fizesd-ki');
  await kep(p, '02_anna_fizesd_ki', { teljes: true });
});
// 2. Lakatos Gréta – KATA: Főoldal (cégnek számlázott), Határidők, Mennyit kerestem?
await futas('greta', 'greta', async (p) => {
  await kep(p, '03_greta_fooldal', { teljes: true });
  await menj(p, '/hataridok');
  await kep(p, '04_greta_hataridok', { teljes: true });
  await menj(p, '/kereset');
  await kep(p, '05_greta_kereset');
});
// 3. Fodor Márk – felmondás alatt: Főoldal + Előfizetés
await futas('mark', 'mark', async (p) => {
  await kep(p, '06_mark_fooldal');
  await menj(p, '/fiok/elofizetes');
  await kep(p, '07_mark_elofizetes', { teljes: true });
});
// 4. Szabó Kata – a bevételi kimutatás csak a már megérkezett pénzzel
await futas('kata', 'kata', async (p) => {
  await menj(p, '/kimutatas');
  await kep(p, '08_kata_kimutatas', { teljes: true });
});
// 5. Gréta – the invoice to a business customer carries the red KATA line
await futas('greta_szamla', 'greta', async (p) => {
  const e = await p.waitForSelector('::-p-text(Cégtől jött pénz)', { timeout: 15_000 }).catch(() => null);
  if (e) {
    await e.click();
    await var_(2000);
  }
  await kep(p, '09_greta_szamla');
});
// 6. Tóth Levente – in onboarding: Fiók shows "Díjak és számlák"
await futas('levente', 'levente', async (p) => {
  await menj(p, '/fiok');
  await kep(p, '10_levente_fiok', { teljes: true });
});
writeFileSync(join(ki, 'k7c2j_eredmeny.json'), JSON.stringify(eredmeny, null, 2));
console.log('kész:', eredmeny.length);
