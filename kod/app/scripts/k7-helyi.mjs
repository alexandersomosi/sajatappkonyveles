#!/usr/bin/env node
// SPEC §29.10.5 (k7, B3) – the guided first run with the REAL backend (scripts/helyi-proba.mjs, PGlite + demo seed):
// login → /bevezeto → W1–W3 → the current step, "Később folytatom" → the checklist with "Folytasd ott, ahol abbahagytad",
// "Folytatom" → the same step again; a new-business client too. Screenshots → kod/_qa/k7_helyi_*.png (390 × 844 @2x).
//   BACKEND_KOD=<mappa> APP_DIST=dist-web-k7b3 PORT=8853 node scripts/helyi-proba.mjs   (külön ablakban)
//   BASE=http://127.0.0.1:8853 node scripts/k7-helyi.mjs
import { mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(app, '../panel/package.json'));
const puppeteer = require('puppeteer-core');
const BASE = process.env.BASE || 'http://127.0.0.1:8853';
const ki = resolve(app, '..', '_qa');
mkdirSync(ki, { recursive: true });
const var_ = (ms) => new Promise((r) => setTimeout(r, ms));
const eredmeny = [];

async function kattint(page, szoveg) {
  const e = await page.waitForSelector(`::-p-text(${JSON.stringify(szoveg)})`, { timeout: 15_000 });
  await e.evaluate((x) => x.scrollIntoView({ block: 'center' }));
  await var_(250);
  await e.click();
  await var_(1500);
}
async function lo(page, nev) {
  await var_(900);
  await page.screenshot({ path: join(ki, `k7_helyi_${nev}.png`) });
  const ut = new URL(page.url()).pathname + new URL(page.url()).search;
  eredmeny.push(`${nev}: ${ut}`);
  console.log(`kép: k7_helyi_${nev}  ${ut}`);
}

async function futas(nev, ki_, lepesek) {
  const prof = join(tmpdir(), `kezjegy_k7helyi_${process.pid}_${nev}`);
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, userDataDir: prof, args: ['--no-first-run', '--hide-scrollbars'] });
  try {
    const page = await b.newPage();
    const hibak = [];
    page.on('pageerror', (e) => hibak.push(e.message));
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await page.goto(`${BASE}/__helyi/belep?ki=${ki_}&ide=/`, { waitUntil: 'networkidle0', timeout: 60_000 });
    await var_(2500);
    await lepesek(page);
    if (hibak.length) console.log(`${nev} oldalhiba: ${hibak.join(' | ').slice(0, 400)}`);
  } catch (e) {
    console.log(`HIBA ${nev}: ${e.message}`);
  } finally {
    await b.close();
    rmSync(prof, { recursive: true, force: true });
  }
}

// 1. Németh Péter (van út, bekötés közben): az első belépés a bevezetőbe visz
await futas('peter', 'peter', async (p) => {
  await lo(p, '01_peter_w1');
  await kattint(p, 'Tovább');
  await lo(p, '02_peter_w2');
  await kattint(p, 'Tovább');
  await lo(p, '03_peter_w3');
  await kattint(p, 'Kezdjük');
  await var_(1500);
  await lo(p, '04_peter_kovetkezo_lepes');
  await kattint(p, 'Később folytatom');
  await lo(p, '05_peter_bekotes_folytasd');
  await kattint(p, 'Folytatom');
  await var_(1500);
  await lo(p, '06_peter_folytatom');
  // újra belép: a szünet nélkül a bevezető a megfelelő lépésnél (az üdvözlés már nem jön)
  await p.goto(`${BASE}/`, { waitUntil: 'networkidle0' });
  await var_(2500);
  await lo(p, '07_peter_ujra_fooldal');
});
// 2. Tóth Levente (új vállalkozás): a saját sorrend
await futas('levente', 'levente', async (p) => {
  await lo(p, '08_levente_w1');
  await kattint(p, 'Tovább');
  await kattint(p, 'Tovább');
  await kattint(p, 'Kezdjük');
  await var_(1500);
  await lo(p, '09_levente_kovetkezo_lepes');
});
// 3. Szabó Kata (aktív ügyfél): soha nem látja a bevezetőt
await futas('kata', 'kata', async (p) => {
  await lo(p, '10_kata_fooldal_nincs_bevezeto');
});
console.log(eredmeny.join('\n'));
