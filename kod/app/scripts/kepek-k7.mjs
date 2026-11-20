#!/usr/bin/env node
// SPEC §29 (k7, B3) képernyőképek: a vezetett első indulás (G), a kártya / eredmény / „Fizesd ki” / Díjak és számlák (A),
// MINTA build, fej nélküli Chrome (puppeteer-core a kod/panel-ből), lövésenként saját --user-data-dir, 390 × 844 és
// 320 × 640 pt @2x → kod/_qa/k7_*.png.
//   EXPO_PUBLIC_API_MODE=minta npx expo export -p web --output-dir dist-minta-k7b3 && node scripts/kepek-k7.mjs [előtag …]
//   PORT=8851 MAPPA=dist-minta-k7b3 (a B2 a 8831–8839-et használja)
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
const PORT = Number(process.env.PORT || 8851);
const MAPPA = process.env.MAPPA || 'dist-minta-k7b3';
const ki = resolve(app, '..', '_qa');
mkdirSync(ki, { recursive: true });

const var_ = (ms) => new Promise((r) => setTimeout(r, ms));
async function kattint(page, szoveg, n = 0) {
  const elemek = await page.$$(`::-p-text(${JSON.stringify(szoveg)})`);
  if (!elemek.length) throw new Error(`nincs ilyen szöveg: ${szoveg}`);
  await elemek[Math.min(n, elemek.length - 1)].evaluate((x) => x.scrollIntoView({ block: 'center' }));
  await var_(300);
  await elemek[Math.min(n, elemek.length - 1)].click();
  await var_(1100);
}
async function gepel(page, szoveg) {
  const mezo = await page.$('input');
  if (!mezo) throw new Error('nincs beviteli mező');
  await mezo.click();
  await page.keyboard.type(szoveg, { delay: 30 });
  await var_(1600);
}
async function gorget(page, szoveg) {
  const e = await page.$(`::-p-text(${JSON.stringify(szoveg)})`);
  if (e) await e.evaluate((x) => x.scrollIntoView({ block: 'start' }));
  await var_(400);
}

// [név, útvonal, magasság-szorzó, művelet]
const LOVESEK = [
  // G – vezetett első indulás
  ['k7_01_fooldal_atiranyit_w1', '/?minta=uj', 1],
  ['k7_02_w1_udv', '/bevezeto/udv?minta=uj', 1],
  ['k7_03_w2_konyvelod', '/bevezeto/udv?minta=uj&lap=2', 1],
  ['k7_04_w3_igy_indulunk', '/bevezeto/udv?minta=uj&lap=3', 1.25],
  ['k7_05_ut', '/bevezeto/ut?minta=uj', 1],
  ['k7_05b_ut_hogyan', '/bevezeto/ut?minta=uj', 1, (p) => kattint(p, 'Még nincs, most indítanám')],
  ['k7_06_adoszam', '/bevezeto/adoszam?minta=bevezeto_adoszam', 1],
  ['k7_06b_adoszam_talalt', '/bevezeto/adoszam?minta=bevezeto_adoszam', 1, (p) => gepel(p, '68707893')],
  ['k7_06c_adoszam_megerosit_nev', '/bevezeto/adoszam?minta=bevezeto_adoszam', 1, async (p) => { await gepel(p, '68707893'); await kattint(p, 'Igen, ez az enyém'); }],
  ['k7_06d_adoszam_szekhely', '/bevezeto/adoszam?minta=bevezeto_adoszam', 1, async (p) => { await gepel(p, '68707893'); await kattint(p, 'Igen, ez az enyém'); await kattint(p, 'Rendben'); }],
  ['k7_06e_adoszam_nav_nem_erheto', '/bevezeto/adoszam?minta=bevezeto_adoszam', 1, (p) => gepel(p, '22222222')],
  ['k7_06f_adoszam_most_nem_tudom', '/bevezeto/adoszam?minta=bevezeto_adoszam', 1, (p) => kattint(p, 'Most nem tudom')],
  ['k7_07_adatok_vezetett', '/bekotes/adatok?minta=bevezeto_adoszam&vezetett=adatok', 1],
  ['k7_08_kedvezmeny_kapu_vezetett', '/kedvezmenyek/kerdoiv?minta=bevezeto_szunet&vezetett=kedvezmenyek', 1],
  ['k7_09_szerzodes_vezetett', '/bekotes/szerzodes?minta=bevezeto_szunet&vezetett=szerzodes', 1],
  ['k7_10_meghatalmazas_vezetett', '/bekotes/meghatalmazas?minta=bevezeto_szunet&vezetett=meghatalmazas', 1],
  ['k7_11_var', '/bevezeto/var?minta=bevezeto_var&lepes=meghatalmazas', 1],
  ['k7_12_kartya_vezetett', '/bekotes/elofizetes?minta=kartya&vezetett=elofizetes', 1],
  ['k7_12b_kartya_teljes', '/bekotes/elofizetes?minta=kartya&vezetett=elofizetes', 2, (p) => kattint(p, 'Elolvastam, és engedélyezem a havi levonást.')],
  ['k7_13_eredmeny_sikeres', '/elofizetes/eredmeny?minta=kartya&cs=MINTA-CS-1&cel=elofizetes', 1],
  ['k7_13b_eredmeny_sikertelen', '/elofizetes/eredmeny?minta=kartya&cs=MINTA-HIBA-1&cel=elofizetes', 1],
  ['k7_13c_eredmeny_megszakitva', '/elofizetes/eredmeny?minta=kartya&cel=elofizetes&megszakitva=1', 1],
  ['k7_14_kesz', '/bevezeto/kesz?minta=bevezeto_kesz', 1.3],
  ['k7_15_bekotes_folytasd', '/bekotes?minta=bevezeto_szunet', 1.2],
  // A – fizetés az aktív ügyfélnél
  ['k7_16_fiok_elofizetes', '/fiok/elofizetes?minta=kata', 1.5],
  ['k7_16b_kartyacsere', '/fiok/elofizetes?minta=kata', 1.6, (p) => kattint(p, 'Kártya cseréje')],
  ['k7_16c_lemondas', '/fiok/elofizetes?minta=kata', 1, (p) => kattint(p, 'Lemondom')],
  ['k7_17_fooldal_fizetesre_var', '/?minta=fizesd', 1],
  ['k7_18_fizesd_ki', '/fizesd-ki?minta=fizesd', 1.3],
  ['k7_18b_fizesd_ki_masik_kartya', '/fizesd-ki?minta=fizesd', 1.4, (p) => kattint(p, 'Másik kártyával fizetek')],
  ['k7_19_dijak', '/fiok/dijak?minta=norbert', 1.8],
  ['k7_19b_dij_fizetes', '/fiok/dijak?minta=norbert', 1, (p) => kattint(p, 'Fizetek')],
  ['k7_19c_dijszamlak_sztorno', '/fiok/dijak?minta=kata', 2.2],
  // §29.4.3 elválasztó: a belépési képernyők is
  ['k7_20_belepes', '/belepes?minta=kint', 1],
  ['k7_21_regisztracio', '/regisztracio?minta=kint', 1.6],
];

async function egy(base, [nev, ut, szorzo, muvelet], szel, mag) {
  const prof = join(tmpdir(), `kezjegy_k7b3_${process.pid}_${nev}_${szel}`).replace(/\\/g, '/');
  const b = await puppeteer.launch({ executablePath: chrome, headless: true, userDataDir: prof, args: ['--no-first-run', '--no-default-browser-check', '--mute-audio', '--hide-scrollbars'] });
  try {
    const page = await b.newPage();
    const hibak = [];
    page.on('pageerror', (e) => hibak.push(e.message));
    await page.setViewport({ width: szel, height: Math.round(mag * szorzo), deviceScaleFactor: 2 });
    await page.goto(`${base}${ut}${ut.includes('?') ? '&' : '?'}szelesseg=${szel}`, { waitUntil: 'networkidle0', timeout: 60_000 });
    await var_(1500);
    if (muvelet) await muvelet(page);
    await var_(700);
    const cel = join(ki, `${nev}_${szel}.png`).replace(/\\/g, '/');
    await page.screenshot({ path: cel });
    console.log(`kész: ${nev}_${szel} ${page.url().replace(base, '')}${hibak.length ? ` (oldalhiba: ${hibak.join(' | ').slice(0, 300)})` : ''}`);
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
  if (!existsSync(join(app, MAPPA, 'index.html'))) throw new Error(`Előbb: export a ${MAPPA} mappába`);
  const szuro = process.argv.slice(2);
  const lista = LOVESEK.filter(([n]) => !szuro.length || szuro.some((s) => n.startsWith(s)));
  const meretek = [[390, 844], [320, 640]].filter(([w]) => !process.env.SZELESSEG || String(w) === process.env.SZELESSEG);
  const base = `http://127.0.0.1:${PORT}`;
  const srv = spawn(process.execPath, [join(app, 'scripts/kiszolgalo.mjs'), join(app, MAPPA), String(PORT)], { stdio: ['ignore', 'pipe', 'pipe'] });
  const indult = await new Promise((ok) => {
    const t = setTimeout(() => ok(false), 5000);
    srv.stdout.on('data', (d) => String(d).includes('kiszolgáló:') && (clearTimeout(t), ok(true)));
    srv.on('exit', () => (clearTimeout(t), ok(false)));
  });
  if (!indult) throw new Error(`A ${PORT}-es port foglalt vagy a kiszolgáló nem indult`);
  try {
    const sor = lista.flatMap((l) => meretek.map(([w, h]) => [l, w, h]));
    const dolgozo = async () => {
      while (sor.length) {
        const [l, w, h] = sor.shift();
        await egy(base, l, w, h);
      }
    };
    await Promise.all(Array.from({ length: Number(process.env.PARHUZAMOS || 4) }, dolgozo));
  } finally {
    srv.kill();
  }
}
main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
