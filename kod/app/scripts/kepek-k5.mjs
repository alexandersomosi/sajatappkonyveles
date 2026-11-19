#!/usr/bin/env node
// SPEC §27 képernyőképek (k5_app_*): fej nélküli Chrome (puppeteer-core a kod/panel-ből), minden lövés saját
// --user-data-dir-rel, 390 × 844 és 320 × 640 pt @2x → kod/_qa/. Alapból a MINTA buildet (dist-minta) fotózza;
// HELYI=1 esetén a helyi próbát (scripts/helyi-proba.mjs, valódi backend) a seed-felhasználókkal (/__helyi/belep).
//   npm run export:minta && node scripts/kepek-k5.mjs [név-előtag …]     PORT=8833 (B2: 8831–8839)
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
const PORT = Number(process.env.PORT || 8833);
const ki = resolve(app, '..', '_qa');
mkdirSync(ki, { recursive: true });

const var_ = (ms) => new Promise((r) => setTimeout(r, ms));
async function kattint(page, szoveg, n = 0) {
  const elemek = await page.$$(`::-p-text(${JSON.stringify(szoveg)})`);
  if (!elemek.length) throw new Error(`nincs ilyen szöveg: ${szoveg}`);
  // a fülsor alá lógó gombot előbb a képernyő közepére görgetjük (különben a fülsor fátyla kapná a koppintást)
  await elemek[Math.min(n, elemek.length - 1)].evaluate((x) => x.scrollIntoView({ block: 'center' }));
  await var_(300);
  await elemek[Math.min(n, elemek.length - 1)].click();
  await var_(900);
}
async function gorget(page, szoveg) {
  const e = await page.$(`::-p-text(${JSON.stringify(szoveg)})`);
  if (e) await e.evaluate((x) => x.scrollIntoView({ block: 'start' }));
  await var_(400);
}

// [név, útvonal, magasság-szorzó (1 = egy képernyő), művelet]
const LOVESEK = [
  ['k5_app_01_fooldal_kerdes', '/bekotes?minta=uj', 1],
  ['k5_app_01b_fooldal_kerdes_teljes', '/bekotes?minta=uj', 2.2],
  ['k5_app_02_hogyan_jelentsuk_be', '/bekotes?minta=uj', 1, (p) => kattint(p, 'Még nincs, most indítanám')],
  ['k5_app_03_fooldal_peter_van', '/bekotes?minta=peter', 2.6],
  ['k5_app_04_valtas_lap', '/bekotes?minta=peter', 1, (p) => kattint(p, 'Módosítom')],
  ['k5_app_05_valtas_zarolt', '/bekotes?minta=levente', 1, (p) => kattint(p, 'Módosítom')],
  ['k5_app_06_fooldal_marika_jovahagyas', '/bekotes?minta=marika', 1],
  ['k5_app_06b_fooldal_marika_teljes', '/bekotes?minta=marika', 2.8],
  ['k5_app_07_jovahagyas_bevezeto', '/bekotes/meghatalmazas/jovahagyas?minta=marika', 1.6],
  ['k5_app_07b_jovahagyas_lepes4', '/bekotes/meghatalmazas/jovahagyas?minta=marika&lepes=4', 1.8],
  ['k5_app_07c_jovahagyas_utolso', '/bekotes/meghatalmazas/jovahagyas?minta=marika&lepes=6', 1.2],
  ['k5_app_08_helyettunk_ev', '/helyettunk?minta=indul&fajta=vallalkozas_bejelentes&forras=helyettunk_vallalkozas', 1],
  ['k5_app_08b_helyettunk_ev_teljes', '/helyettunk?minta=indul&fajta=vallalkozas_bejelentes&forras=helyettunk_vallalkozas', 3.2],
  ['k5_app_09_helyettunk_mh', '/helyettunk?minta=kamara&fajta=meghatalmazas&forras=helyettunk_meghatalmazas', 1],
  ['k5_app_09b_helyettunk_allapot', '/helyettunk?minta=marika&fajta=vallalkozas_bejelentes', 2.2],
  ['k5_app_10_meghatalmazas_valasztas', '/bekotes/meghatalmazas?minta=kamara', 1],
  ['k5_app_11_meghatalmazas_magam_bevezeto', '/bekotes/meghatalmazas?minta=kamara&mod=magam&lepes=0', 1.6],
  ['k5_app_11b_meghatalmazas_magam_lepes3', '/bekotes/meghatalmazas?minta=kamara&mod=magam&lepes=3', 1.8],
  ['k5_app_12_meghatalmazas_david', '/bekotes/meghatalmazas?minta=david', 1.8],
  ['k5_app_12b_fooldal_david', '/bekotes?minta=david', 2.6],
  ['k5_app_13_kozpont_onallo', '/bekotes/vallalkozas?minta=indul', 1],
  ['k5_app_13b_kozpont_onallo_teljes', '/bekotes/vallalkozas?minta=indul', 1.8],
  ['k5_app_14_kozpont_segitett', '/bekotes/vallalkozas?minta=marika', 1.6],
  ['k5_app_15_megsem_most', '/bekotes/vallalkozas?minta=indul', 1, async (p) => { await gorget(p, 'Mégsem most?'); await kattint(p, 'Mégsem most?'); }],
  ['k5_app_16_kerdoiv_1', '/bekotes/vallalkozas/adatlap?minta=indul&lap=1', 1.4],
  ['k5_app_16b_kerdoiv_5', '/bekotes/vallalkozas/adatlap?minta=utmutato&lap=5', 2.2],
  ['k5_app_16c_kerdoiv_4', '/bekotes/vallalkozas/adatlap?minta=utmutato&lap=4', 1.8],
  ['k5_app_17_utmutato_bevezeto', '/bekotes/vallalkozas/utmutato?minta=utmutato', 1.4],
  ['k5_app_17b_utmutato_lepes3_valodi', '/bekotes/vallalkozas/utmutato?minta=utmutato&lepes=3', 2],
  ['k5_app_17c_utmutato_lepes5_rajzolt', '/bekotes/vallalkozas/utmutato?minta=utmutato&lepes=5', 2],
  ['k5_app_17d_utmutato_tart', '/bekotes/vallalkozas/utmutato?minta=marika&lepes=1', 1.6],
  ['k5_app_18_feltoltes', '/bekotes/vallalkozas/feltoltes?minta=utmutato', 2],
  ['k5_app_19_engedely', '/bekotes/vallalkozas/engedely?minta=engedely', 3],
  ['k5_app_20_kamara', '/bekotes/vallalkozas/kamara?minta=kamara', 1],
  ['k5_app_21_fooldal_kamara', '/bekotes?minta=kamara', 1],
  ['k5_app_22_azonositas_adatok', '/bekotes/azonositas?minta=kamara', 1.4, (p) => gorget(p, 'Az adataid')],
  ['k5_app_23_adatok_van_2', '/bekotes/adatok?minta=peter&lap=2', 1.4],
  ['k5_app_24_adatok_rolad', '/bekotes/adatok?minta=indul&utana=vallalkozas', 1.3],
  ['k5_app_25_visszahivas', '/visszahivas?minta=indul&forras=bekotes&tema=bekotes', 1.8],
  ['k5_app_26_fiok_bekotes', '/fiok?minta=indul', 1.8],
  ['k5_app_27_uzenetek_bekotes', '/uzenetek?minta=indul', 1],
  ['k5_app_28_zarolt_lap', '/bekotes?minta=indul', 1, (p) => kattint(p, 'Fotózás')],
  ['k5_app_29_dosszie_szamlak', '/dosszie?minta=kata', 1.6, (p) => gorget(p, 'Amit te küldtél')],
  ['k5_app_30_regisztracio', '/regisztracio?minta=kint', 1],
  ['k5_app_31_fooldal_bekuldve', '/bekotes?minta=bekuldve', 1],
  ['k5_app_32_fooldal_ilona', '/bekotes?minta=ilona', 1],
  ['k5_app_33_fizetes_ellenorzes', '/elofizetes/eredmeny?minta=uj&e=SUCCESS&t=123', 1],
  ['k5_app_34_fooldal_levente_varakozas', '/bekotes?minta=levente', 1],
  ['k5_app_35_fooldal_indul', '/bekotes?minta=indul', 2.4],
  ['k5_app_36_aktivalas', '/?minta=kata', 1],
];

// HELYI=1: valódi backend (helyi próba), belépés a /__helyi/belep útvonalon (jelszó nincs a parancssorban).
const be = (kiki, ide) => `/__helyi/belep?ki=${kiki}&ide=${encodeURIComponent(ide)}`;
const HELYI_LOVESEK = [
  ['k5_app_h01_levente_fooldal', be('levente', '/bekotes'), 2.6],
  ['k5_app_h02_levente_valtas_zarolt', be('levente', '/bekotes'), 1, (p) => kattint(p, 'Módosítom')],
  ['k5_app_h03_peter_fooldal', be('peter', '/bekotes'), 2.6],
  ['k5_app_h04_peter_valtas', be('peter', '/bekotes'), 1, (p) => kattint(p, 'Módosítom')],
  ['k5_app_h05_levente_utmutato_lepes', be('levente', '/bekotes/vallalkozas/utmutato?lepes=3'), 2],
  ['k5_app_h06_peter_meghatalmazas', be('peter', '/bekotes/meghatalmazas'), 1.4],
  ['k5_app_h07_zsofia_fooldal', be('zsofia', '/bekotes'), 2.4],
  ['k5_app_h08_kata_dosszie', be('kata', '/dosszie'), 1.6, (p) => gorget(p, 'Amit te küldtél')],
  ['k5_app_h09_marika_fooldal', be('marika', '/bekotes'), 2.6],
  ['k5_app_h10_david_meghatalmazas', be('david', '/bekotes/meghatalmazas'), 1.8],
];

async function egy(base, [nev, ut, szorzo, muvelet], szel, mag) {
  const prof = join(tmpdir(), `kezjegy_k5_${process.pid}_${nev}_${szel}`).replace(/\\/g, '/');
  const b = await puppeteer.launch({ executablePath: chrome, headless: true, userDataDir: prof, args: ['--no-first-run', '--no-default-browser-check', '--mute-audio', '--hide-scrollbars'] });
  try {
    const page = await b.newPage();
    const hibak = [];
    page.on('pageerror', (e) => hibak.push(e.message));
    await page.setViewport({ width: szel, height: Math.round(mag * szorzo), deviceScaleFactor: 2 });
    await page.goto(`${base}${ut}${ut.includes('?') ? '&' : '?'}szelesseg=${szel}`, { waitUntil: 'networkidle0', timeout: 60_000 });
    await var_(1400);
    if (muvelet) await muvelet(page);
    await var_(600);
    const cel = join(ki, `${nev}_${szel}.png`).replace(/\\/g, '/');
    await page.screenshot({ path: cel });
    console.log(`kész: ${nev}_${szel}${hibak.length ? ` (oldalhiba: ${hibak.join(' | ').slice(0, 300)})` : ''}`);
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
  const meretek = [[390, 844], [320, 640]].filter(([w]) => !process.env.SZELESSEG || String(w) === process.env.SZELESSEG);
  let srv = null;
  const base = helyi ? (process.env.BASE || 'http://127.0.0.1:8832') : `http://127.0.0.1:${PORT}`;
  if (!helyi) {
    srv = spawn(process.execPath, [join(app, 'scripts/kiszolgalo.mjs'), join(app, 'dist-minta'), String(PORT)], { stdio: ['ignore', 'pipe', 'pipe'] });
    const indult = await new Promise((ok) => {
      const t = setTimeout(() => ok(false), 5000);
      srv.stdout.on('data', (d) => String(d).includes('kiszolgáló:') && (clearTimeout(t), ok(true)));
      srv.on('exit', () => (clearTimeout(t), ok(false)));
    });
    if (!indult) throw new Error(`A ${PORT}-es port foglalt vagy a kiszolgáló nem indult: PORT=<másik> node scripts/kepek-k5.mjs`);
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
