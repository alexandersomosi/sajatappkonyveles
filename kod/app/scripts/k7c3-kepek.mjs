#!/usr/bin/env node
// k7c3 adversarial round 3 (2026-11-20) – payments: a client with an unpaid month pays TWICE through two screens
// (Fizesd ki = the oldest month, the card step = a month from today). REAL backend (scripts/helyi-proba.mjs, PGlite +
// demo seed incl. seed:k29, DEMO pay page). Fake data only; no password typed (the harness' /__helyi/belep).
//   PORT=8937 node scripts/helyi-proba.mjs   (külön ablakban)
//   BASE=http://127.0.0.1:8937 node scripts/k7c3-kepek.mjs   → kod/_qa/k7c3_fizetés_*.png (390 × 844 @2x)
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(app, '../panel/package.json'));
const puppeteer = require('puppeteer-core');
const BASE = process.env.BASE || 'http://127.0.0.1:8937';
const ki = resolve(app, '..', '_qa');
mkdirSync(ki, { recursive: true });
const var_ = (ms) => new Promise((r) => setTimeout(r, ms));
const eredmeny = [];

async function kep(page, nev, opt = {}) {
  await var_(1300);
  await page.screenshot({ path: join(ki, `k7c3_fizetés_${nev}.png`), fullPage: Boolean(opt.teljes) });
  const szoveg = await page.evaluate(() => document.body.innerText.slice(0, 5000));
  eredmeny.push({ nev, ut: new URL(page.url()).pathname + new URL(page.url()).search, szoveg });
  console.log(`kép: k7c3_fizetés_${nev}  ${new URL(page.url()).pathname}`);
}
const menj = async (page, ut) => {
  await page.goto(ut.startsWith('http') ? ut : `${BASE}${ut}`, { waitUntil: 'networkidle0', timeout: 60_000 });
  await var_(1500);
};
async function kattints(page, szoveg, o = {}) {
  // text match in the page (puppeteer's ::-p-text() breaks on "(" in the text)
  const h = await page.waitForFunction(
    (t) => {
      const c = [...document.querySelectorAll('button,[role=button],[role=checkbox],a,div,span')].filter((e) => e.offsetParent !== null && (e.innerText || '').trim().startsWith(t));
      c.sort((a, b) => a.innerText.length - b.innerText.length);
      return c[0] || null;
    },
    { timeout: o.timeout ?? 15_000 },
    szoveg,
  );
  await h.asElement().click();
  await var_(o.var ?? 2500);
}
/** The app refuses a non-https hosted URL (local harness = http): take it from the API answer and open it directly. */
function urlFigyelo(page) {
  let utolso = null;
  page.on('response', async (r) => {
    if (r.request().method() !== 'POST' || !/\/client\/(payments\/due\/pay|subscription\/start)$/.test(new URL(r.url()).pathname)) return;
    try {
      const j = await r.json();
      if (j && j.url) utolso = j.url;
    } catch {
      /* not json */
    }
  });
  return () => utolso;
}

const prof = join(tmpdir(), `kezjegy_k7c3_${process.pid}`);
const b = await puppeteer.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, userDataDir: prof, args: ['--no-first-run', '--hide-scrollbars'] });
try {
  const page = await b.newPage();
  const hibak = [];
  page.on('pageerror', (e) => hibak.push(e.message));
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto(`${BASE}/__helyi/belep?ki=${encodeURIComponent('auth+anna')}&ide=/`, { waitUntil: 'networkidle0', timeout: 60_000 });
  await var_(1800);
  // 1. Főoldal: the unpaid month (the charge waits for the bank's confirmation)
  await kep(page, '01_anna_fooldal_fizetesre_var');
  const url = urlFigyelo(page);
  // 2. Fizesd ki → the pay page of the OLDEST month opens; the client leaves it open (another tab)
  await menj(page, '/fizesd-ki');
  await kep(page, '02_anna_fizesd_ki', { teljes: true });
  await kattints(page, 'Fizesd ki (', { var: 3500 });
  const fizesdKiOldal = url();
  if (!fizesdKiOldal) throw new Error('nincs Fizesd ki fizetési cím');
  await menj(page, fizesdKiOldal);
  await kep(page, '03_anna_fizesd_ki_fizetooldal_nyitva');
  // 3. Meanwhile the card step (Bekötés → Előfizetés) still offers a NEW month from today
  await menj(page, '/bekotes/elofizetes');
  await kep(page, '04_anna_kartya_lepes_uj_honap_mai_naptol', { teljes: true });
  await kattints(page, 'Elolvastam, és engedélyezem', { var: 800 });
  await kattints(page, 'Tovább a kártyához', { var: 3500 });
  const kartyaOldal = url();
  if (!kartyaOldal || kartyaOldal === fizesdKiOldal) throw new Error('nincs külön kártyalépés-fizetési cím');
  await menj(page, kartyaOldal);
  await kep(page, '05_anna_kartya_lepes_fizetooldal');
  await kattints(page, 'Sikeres fizetés szimulálása', { var: 6000 });
  await kep(page, '06_anna_kartya_lepes_kifizetve');
  // 4. The first page (Fizesd ki) is still payable: the client finishes it too
  await menj(page, fizesdKiOldal);
  await kep(page, '07_anna_elso_oldal_meg_fizetheto');
  await kattints(page, 'Sikeres fizetés szimulálása', { var: 6000 });
  await kep(page, '08_anna_fizesd_ki_is_kifizetve');
  // 5. Fiók → Díjak és számlák: two monthly fees for overlapping periods, nothing refunded
  await menj(page, '/fiok/dijak');
  await kep(page, '09_anna_dijak_ket_havidij', { teljes: true });
  const api = await page.evaluate(async () => {
    const r = await fetch('/api/v1/client/payments', { credentials: 'include' });
    return r.ok ? r.json() : { status: r.status };
  });
  eredmeny.push({ nev: 'api_client_payments', api });
  if (hibak.length) console.log('oldalhibák:', hibak.slice(0, 3));
} catch (e) {
  console.log('HIBA', e.message);
  eredmeny.push({ hiba: e.message });
} finally {
  await b.close();
}
writeFileSync(join(ki, 'k7c3', 'k7c3_kepek_eredmeny.json'), JSON.stringify(eredmeny, null, 2));
console.log('kész:', eredmeny.length);
