#!/usr/bin/env node
// SPEC §26 képernyőképek (k3_*): fej nélküli Chrome (puppeteer-core a kod/panel-ből), minden lövés saját
// --user-data-dir-rel, 390 × 844 és 360 × 780 pt @2x. Alapból a MINTA buildet (dist-minta) fotózza; HELYI=1 esetén a
// helyi próbát (scripts/helyi-proba.mjs, valódi backend, http://127.0.0.1:8791) a seed-felhasználókkal.
//   node scripts/kepek-k3.mjs [név-előtag …]      SZELESSEG=390 csak az egyik szélesség
import { spawn } from 'node:child_process';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(app, '../panel/package.json'));
const puppeteer = require('puppeteer-core');
const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = Number(process.env.PORT || 8853);
const ki = join(app, '_kepek');
mkdirSync(ki, { recursive: true });

const var_ = (ms) => new Promise((r) => setTimeout(r, ms));
async function kattint(page, szoveg, n = 0) {
  const elemek = await page.$$(`::-p-text(${JSON.stringify(szoveg)})`);
  if (!elemek.length) throw new Error(`nincs ilyen szöveg: ${szoveg}`);
  await elemek[Math.min(n, elemek.length - 1)].click();
  await var_(700);
}
async function gorget(page, szoveg) {
  const e = await page.$(`::-p-text(${JSON.stringify(szoveg)})`);
  if (e) await e.evaluate((x) => x.scrollIntoView({ block: 'start' }));
  await var_(400);
}
async function gepel(page, felirat, szoveg) {
  const e = await page.$(`input[aria-label="${felirat}"], textarea[aria-label="${felirat}"]`);
  if (!e) throw new Error(`nincs ilyen mező: ${felirat}`);
  await e.click();
  await e.type(szoveg, { delay: 20 });
  await var_(500);
}

// [név, útvonal, magasság-szorzó (1 = egy képernyő), művelet]
const LOVESEK = [
  ['k3_01_fooldal_uj', '/bekotes?minta=uj', 1],
  ['k3_01b_fooldal_uj_teljes', '/bekotes?minta=uj', 3],
  ['k3_02_magyarazat_elagazas', '/bekotes?minta=uj', 1, (p) => kattint(p, 'Mi ez?')],
  ['k3_02b_magyarazat_adoazonosito', '/bekotes/adatok?minta=uj', 1.2, (p) => kattint(p, 'Hol találom?', 1)],
  ['k3_03_dosszie_zarolt', '/dosszie?minta=uj', 1],
  ['k3_04_fotozas_zarolt', '/bekotes?minta=uj', 1, (p) => kattint(p, 'Fotózás')],
  ['k3_05_vallalkozas_elokeszit', '/bekotes/vallalkozas?minta=indul', 2.4],
  ['k3_06a_adatlap_1', '/bekotes/vallalkozas/adatlap?minta=indul&lap=1', 1.6],
  ['k3_06b_adatlap_stop', '/bekotes/vallalkozas/adatlap?minta=indul&lap=1', 1.6, async (p) => { await kattint(p, 'Évi 20 millió forintnál több'); await gorget(p, 'Évente nagyjából'); }],
  ['k3_06c_adatlap_2_kereses', '/bekotes/vallalkozas/adatlap?minta=indul&lap=2', 1.4, (p) => gepel(p, 'Keresés', 'foto')],
  ['k3_06d_adatlap_2_valasztva', '/bekotes/vallalkozas/adatlap?minta=indul&lap=2', 1.6, async (p) => { await gepel(p, 'Keresés', 'foto'); await kattint(p, 'Fotózás, képszerkesztés'); await gepel(p, 'Keresés', 'video'); await kattint(p, 'Videókészítés, vágás'); }],
  ['k3_06e_adatlap_3', '/bekotes/vallalkozas/adatlap?minta=utmutato&lap=3', 1.5],
  ['k3_06f_adatlap_4', '/bekotes/vallalkozas/adatlap?minta=utmutato&lap=4', 1.8],
  ['k3_06g_adatlap_5_osszegzes', '/bekotes/vallalkozas/adatlap?minta=utmutato&lap=5', 1.9],
  ['k3_07_utmutato', '/bekotes/vallalkozas/utmutato?minta=utmutato', 1],
  ['k3_07b_utmutato_lepes', '/bekotes/vallalkozas/utmutato?minta=utmutato', 2.6, (p) => gorget(p, 'Adózási adatok – ÁFA')],
  ['k3_07c_utmutato_teljes', '/bekotes/vallalkozas/utmutato?minta=utmutato', 6],
  ['k3_08_kepnezo', '/bekotes/vallalkozas/utmutato?minta=utmutato', 1, async (p) => { await gorget(p, 'Adózási adatok – ÁFA'); await kattint(p, 'Nagyítom'); await var_(600); }],
  ['k3_09_feltoltes', '/bekotes/vallalkozas/feltoltes?minta=utmutato', 1.9],
  ['k3_10_beadva', '/bekotes/vallalkozas?minta=levente', 1.6],
  ['k3_11_fooldal_levente', '/bekotes?minta=levente', 2.8],
  ['k3_12_meghatalmazas', '/bekotes/meghatalmazas?minta=levente', 1],
  ['k3_12b_meghatalmazas_lepes', '/bekotes/meghatalmazas?minta=levente', 2.4, (p) => gorget(p, 'A meghatalmazott adatai')],
  ['k3_13_visszahivas_urlap', '/visszahivas?minta=uj&forras=bekotes&tema=bekotes', 2],
  ['k3_14_visszahivas_allapot', '/visszahivas?minta=peter&forras=fiok&tema=egyeb', 1.3],
  ['k3_15_uzenetek', '/uzenetek?minta=levente', 1],
  ['k3_16_fiok_bekotes', '/fiok?minta=uj', 2],
  ['k3_16b_fiok_lakat', '/fiok?minta=uj', 1, (p) => kattint(p, 'Határidők')],
  ['k3_17_adatok_rolad', '/bekotes/adatok?minta=indul', 1.4],
  ['k3_18_hataridok_zarolt', '/hataridok?minta=uj', 1],
  ['k3_19_gyik', '/gyik?minta=uj', 1.8],
  ['k3_20_fooldal_peter', '/bekotes?minta=peter', 2.6],
  ['k3_21_azonositas', '/bekotes/azonositas?minta=levente', 1.2],
  ['k3_22_elofizetes_zarolt', '/bekotes/elofizetes?minta=levente', 1],
  // A működő lejátszóhoz próbavideó kell: MEDIA_DIR=<mappa bekotes.mp4/.vtt/_poszter.jpg-vel> (a kod/media a videósoké).
  ['k3_23_video_kartya', '/bekotes?minta=uj', 1],
  ['k3_23b_video_lejatszo', '/bekotes?minta=uj', 1, async (p) => {
    await kattint(p, 'Lejátszás');
    await var_(2500);
    const v = await p.evaluate(() => { const x = document.querySelector('video'); return x ? { readyState: x.readyState, paused: x.paused, sav: x.textTracks.length, savNyelv: x.textTracks[0]?.language } : null; });
    console.log('  videó:', JSON.stringify(v));
  }],
];

// HELYI=1: valódi backend (helyi próba, demo seed + 11-18 kiegészítés), belépés a /__helyi/belep útvonalon.
const be = (ki, ide) => `/__helyi/belep?ki=${ki}&ide=${encodeURIComponent(ide)}`;
const HELYI_LOVESEK = [
  ['k3_h01_levente_fooldal', be('levente', '/bekotes'), 2.8],
  ['k3_h02_levente_vallalkozas', be('levente', '/bekotes/vallalkozas'), 1.6],
  ['k3_h03_levente_utmutato', be('levente', '/bekotes/vallalkozas/utmutato'), 1],
  ['k3_h03b_levente_utmutato_lepes', be('levente', '/bekotes/vallalkozas/utmutato'), 2.4, (p) => gorget(p, 'Adózási adatok – munkavégzés jellege')],
  ['k3_h04_levente_meghatalmazas', be('levente', '/bekotes/meghatalmazas'), 1.4],
  ['k3_h05_levente_dosszie', be('levente', '/dosszie'), 1],
  ['k3_h06_levente_visszahivas', be('levente', '/visszahivas?forras=fiok&tema=egyeb'), 1.4],
  ['k3_h07_levente_uzenetek', be('levente', '/uzenetek'), 1],
  ['k3_h08_levente_fiok', be('levente', '/fiok'), 2],
  ['k3_h09_peter_fooldal', be('peter', '/bekotes'), 2.6],
  ['k3_h10_kata_fooldal', be('kata', '/'), 1],
  ['k3_h11_kata_fiok', be('kata', '/fiok'), 2],
];

async function egy(base, [nev, ut, szorzo, muvelet], szel, mag) {
  const prof = join(tmpdir(), `kezjegy_k3_${process.pid}_${nev}_${szel}`).replace(/\\/g, '/');
  const b = await puppeteer.launch({ executablePath: chrome, headless: true, userDataDir: prof, args: ['--no-first-run', '--no-default-browser-check', '--mute-audio', '--hide-scrollbars'] });
  try {
    const page = await b.newPage();
    const hibak = [];
    page.on('pageerror', (e) => hibak.push(e.message));
    await page.setViewport({ width: szel, height: Math.round(mag * szorzo), deviceScaleFactor: 2 });
    await page.goto(`${base}${ut}${ut.includes('?') ? '&' : '?'}szelesseg=${szel}`, { waitUntil: 'networkidle0', timeout: 60_000 });
    await var_(1200);
    if (muvelet) await muvelet(page);
    await var_(500);
    const cel = join(ki, `${nev}_${szel}.png`).replace(/\\/g, '/');
    await page.screenshot({ path: cel });
    console.log(`kész: ${nev}_${szel}${hibak.length ? ` (oldalhiba: ${hibak.join(' | ').slice(0, 200)})` : ''}`);
  } catch (e) {
    console.log(`HIBA: ${nev}_${szel}: ${e.message}`);
  } finally {
    await b.close();
    try {
      rmSync(prof, { recursive: true, force: true });
    } catch {}
  }
}

async function main() {
  const helyi = process.env.HELYI === '1';
  if (!helyi && !existsSync(join(app, 'dist-minta', 'index.html'))) throw new Error('Előbb: npm run export:minta');
  const szuro = process.argv.slice(2);
  const lista = (helyi ? HELYI_LOVESEK : LOVESEK).filter(([n]) => !szuro.length || szuro.some((s) => n.startsWith(s)));
  const meretek = [[390, 844], [360, 780]].filter(([w]) => !process.env.SZELESSEG || String(w) === process.env.SZELESSEG);
  let srv = null;
  const base = helyi ? (process.env.BASE || 'http://127.0.0.1:8791') : `http://127.0.0.1:${PORT}`;
  if (!helyi) {
    srv = spawn(process.execPath, [join(app, 'scripts/kiszolgalo.mjs'), join(app, 'dist-minta'), String(PORT)], { stdio: ['ignore', 'pipe', 'pipe'] });
    // Csak akkor fotózunk, ha a MI kiszolgálónk indult el (foglalt port esetén más szerverét fotóznánk).
    const indult = await new Promise((ok) => {
      const t = setTimeout(() => ok(false), 5000);
      srv.stdout.on('data', (d) => String(d).includes('kiszolgáló:') && (clearTimeout(t), ok(true)));
      srv.on('exit', () => (clearTimeout(t), ok(false)));
    });
    if (!indult) throw new Error(`A ${PORT}-es port foglalt vagy a kiszolgáló nem indult: PORT=<másik> node scripts/kepek-k3.mjs`);
  }
  try {
    const sor = lista.flatMap((l) => meretek.map(([w, h]) => [l, w, h]));
    const dolgozo = async () => {
      while (sor.length) {
        const [l, w, h] = sor.shift();
        await egy(base, l, w, h);
      }
    };
    await Promise.all(Array.from({ length: Number(process.env.PARHUZAMOS || 3) }, dolgozo));
  } finally {
    srv?.kill();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
