#!/usr/bin/env node
// SPEC §28 + §28.K képernyőképek (k6_app_*): fej nélküli Chrome (puppeteer-core a kod/panel-ből), minden lövés saját
// --user-data-dir-rel, 390 × 844 és 320 × 640 pt @2x → kod/_qa/. Alapból a MINTA buildet (dist-minta) fotózza;
// HELYI=1 esetén a helyi próbát (scripts/helyi-proba.mjs, valódi backend) a seed-felhasználókkal (/__helyi/belep).
//   npm run export:minta && node scripts/kepek-k6.mjs [név-előtag …]     PORT=8833 (B2: 8831–8839)
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
const PORT = Number(process.env.PORT || 8834);
const MAPPA = process.env.MAPPA || 'dist-minta';
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

// [név, útvonal, magasság-szorzó (1 = egy képernyő), művelet]  – SPEC §28 + §28.K (k6), C kinézet + elválasztó sáv
const LOVESEK = [
  ['k6_app_01_fooldal', '/?minta=kata', 1],
  ['k6_app_01b_fooldal_teljes', '/?minta=kata', 6],
  ['k6_app_02_fooldal_fizetendo', '/?minta=fizetendo', 1],
  ['k6_app_03_dosszie', '/dosszie?minta=kata', 1],
  ['k6_app_04_szamlak_lista', '/dosszie/2026-11/szamlak?minta=kata', 1.4],
  ['k6_app_05_szamla_reszlet', '/szamla/nav-KSZ-2026-033?minta=kata', 1.6],
  ['k6_app_05b_miert_ennyi', '/szamla/nav-KSZ-2026-033?minta=kata', 1, (p) => kattint(p, 'Miért ennyi?')],
  ['k6_app_06_felretesz', '/felretesz?minta=kata', 2],
  ['k6_app_07_kereset', '/kereset?minta=kata', 2],
  ['k6_app_08_kedvezmeny_kerdoiv_0', '/kedvezmenyek/kerdoiv?minta=kata', 1],
  ['k6_app_08b_kedvezmeny_kerdoiv_szuletes', '/kedvezmenyek/kerdoiv?minta=kata&lap=1', 1],
  ['k6_app_08c_kedvezmeny_kerdoiv_gyerekek', '/kedvezmenyek/kerdoiv?minta=eszter&lap=3', 1.6],
  ['k6_app_08d_kedvezmeny_kerdoiv_vege', '/kedvezmenyek/kerdoiv?minta=eszter&lap=vege', 1.4],
  ['k6_app_09_kedvezmenyek_eszter', '/kedvezmenyek?minta=eszter', 1.2],
  ['k6_app_09b_kedvezmenyek_balint', '/kedvezmenyek?minta=balint', 1.2],
  ['k6_app_10_valtozas_hub', '/valtozas?minta=kata', 1.3],
  ['k6_app_11_valtozas_szekhely', '/valtozas/valtozas_szekhely?minta=kata', 1.3],
  ['k6_app_11b_valtozas_szuneteltetes', '/valtozas/valtozas_szuneteltetes?minta=kata', 1.4],
  ['k6_app_12_valtozas_utmutato', '/valtozas/valtozas_szekhely/utmutato?minta=kata&lepes=4', 1.6],
  ['k6_app_13_valtozas_kerem', '/valtozas/valtozas_szekhely/kerem?minta=kata', 1.4],
  ['k6_app_14_valtozas_engedely', '/valtozas/engedely?minta=adam&assist=valt-adam', 1.4],
  ['k6_app_15_havi', '/valtozott?minta=kata', 1.4],
  ['k6_app_15b_havi_norbert', '/valtozott?minta=norbert', 1.2],
  ['k6_app_16_eves', '/eves-zaras?minta=eves', 1],
  ['k6_app_16b_eves_kerdoiv', '/eves-zaras/kerdoiv?minta=eves&lap=1', 1.2],
  ['k6_app_17_dijak', '/fiok/dijak?minta=norbert', 1.6],
  ['k6_app_18_zarolt', '/?minta=zarolt', 1],
  ['k6_app_19_szunetel', '/?minta=szunetel', 1.4],
  ['k6_app_20_fiok', '/fiok?minta=kata', 1.6],
  ['k6_app_21_ertesitesek', '/fiok/ertesitesek?minta=kata', 2.2],
  ['k6_app_22_efo', '/bekotes/alkalmazottak?minta=tamas', 1],
  ['k6_app_23_uzenetek', '/uzenetek?minta=kata', 1],
  ['k6_app_24_fiok_elofizetes', '/fiok/elofizetes?minta=kata', 1.4],
  // k5 nyitott #3, #17: a fő gomb felirata 320-on sem csonkolódik (két sorra nőhet)
  ['k6_app_27_ertesitesek_lista', '/ertesitesek?minta=kata', 1.2],
  ['k6_app_25_k5_3_hogyan_jelentsuk_be', '/bekotes?minta=uj', 1, (p) => kattint(p, 'Még nincs, most indítanám')],
  ['k6_app_26_k5_17_fooldal_kamara', '/bekotes?minta=kamara', 1],
];
// a C-restyle előtti/utáni összevetéshez (ELOTTE=1: a régi dist-minta-ból, k6_app_e_*)
const ELOTTE_LOVESEK = [
  ['k6_app_e01_fooldal', '/?minta=kata', 1],
  ['k6_app_e02_dosszie', '/dosszie?minta=kata', 1],
  ['k6_app_e03_szamlak_lista', '/dosszie/2026-11/szamlak?minta=kata', 1],
  ['k6_app_e04_fiok', '/fiok?minta=kata', 1],
  ['k6_app_e05_uzenetek', '/uzenetek?minta=kata', 1],
  ['k6_app_e06_ertesitesek', '/fiok/ertesitesek?minta=kata', 1],
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
  const prof = join(tmpdir(), `kezjegy_k6_${process.pid}_${nev}_${szel}`).replace(/\\/g, '/');
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
  if (!helyi && !existsSync(join(app, MAPPA, 'index.html'))) throw new Error('Előbb: npm run export:minta');
  const szuro = process.argv.slice(2);
  const lista = (helyi ? HELYI_LOVESEK : process.env.ELOTTE === '1' ? ELOTTE_LOVESEK : LOVESEK).filter(([n]) => !szuro.length || szuro.some((s) => n.startsWith(s)));
  const meretek = [[390, 844], [320, 640]].filter(([w]) => !process.env.SZELESSEG || String(w) === process.env.SZELESSEG);
  let srv = null;
  const base = helyi ? (process.env.BASE || 'http://127.0.0.1:8832') : `http://127.0.0.1:${PORT}`;
  if (!helyi) {
    srv = spawn(process.execPath, [join(app, 'scripts/kiszolgalo.mjs'), join(app, MAPPA), String(PORT)], { stdio: ['ignore', 'pipe', 'pipe'] });
    const indult = await new Promise((ok) => {
      const t = setTimeout(() => ok(false), 5000);
      srv.stdout.on('data', (d) => String(d).includes('kiszolgáló:') && (clearTimeout(t), ok(true)));
      srv.on('exit', () => (clearTimeout(t), ok(false)));
    });
    if (!indult) throw new Error(`A ${PORT}-es port foglalt vagy a kiszolgáló nem indult: PORT=<másik> node scripts/kepek-k6.mjs`);
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
