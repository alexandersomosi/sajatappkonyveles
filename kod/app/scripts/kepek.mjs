#!/usr/bin/env node
// Képernyőképek a MINTA webes exportról (dist-minta), fej nélküli Chrome-mal, 390 × 844 pt @2x (a dizájn referenciája).
// Minden lövés saját --user-data-dir-t kap. Előtte: npm run export:minta.  Használat: node scripts/kepek.mjs [név …]
import { execFile, spawn } from 'node:child_process';
import { promisify } from 'node:util';
const futtat = promisify(execFile);
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = 8790;
const ki = join(app, '_kepek');
mkdirSync(ki, { recursive: true });

// [név, útvonal (a ?minta= forgatókönyvvel), magasság pt-ban (844 = egy képernyő; nagyobb = „_teljes”)]
export const LOVESEK = [
  ['01_belepes', '/belepes?minta=kint', 844],
  ['01b_regisztracio', '/regisztracio?minta=kint', 1100],
  ['01c_jelszo_elfelejtve', '/jelszo-elfelejtve?minta=kint', 844],
  ['01d_jelszo_uj', '/jelszo-uj?minta=kint&email=kata.szabo%40demo.kezjegy.test', 844],
  ['01e_ketlepcsos', '/ketlepcsos?minta=kint&t=MINTA-MFA', 844],
  ['01f_email_megerosites', '/email-megerosites?minta=uj', 844],
  ['02_bekotes', '/bekotes?minta=peter', 844],
  ['02_bekotes_teljes', '/bekotes?minta=peter', 1700],
  ['02b_bekotes_uj_teljes', '/bekotes?minta=uj', 1500],
  ['02c_adatok', '/bekotes/adatok?minta=uj', 1100],
  ['02c_adatok_2', '/bekotes/adatok?minta=uj&lap=2', 1300],
  ['02c_adatok_3', '/bekotes/adatok?minta=uj&lap=3', 1200],
  ['02d_szerzodes', '/bekotes/szerzodes?minta=uj', 1100],
  ['02e_elofizetes', '/bekotes/elofizetes?minta=uj', 1500],
  ['02f_meghatalmazas', '/bekotes/meghatalmazas?minta=uj', 1900],
  ['02g_azonositas', '/bekotes/azonositas?minta=uj', 2300],
  ['02h_visszahivas', '/visszahivas?minta=peter&forras=bekotes', 1100], // az időpontfoglalás megszűnt (SPEC §26.2)
  ['03_fooldal', '/?minta=fizetendo', 844],
  ['03_fooldal_teljes', '/?minta=fizetendo', 2700],
  ['03b_fooldal_becsles', '/?minta=kata', 844],
  ['03b_fooldal_becsles_teljes', '/?minta=kata', 2800],
  ['04_dosszie', '/dosszie?minta=fizetendo&honap=2026-10', 844],
  ['04_dosszie_teljes', '/dosszie?minta=fizetendo&honap=2026-10', 2000],
  ['04b_dosszie_november', '/dosszie?minta=kata', 1500],
  ['04c_dosszie_korabbiak', '/dosszie?minta=kata&honap=korabbiak', 1300],
  ['04d_szamlak', '/dosszie/2026-10/szamlak?minta=kata', 844],
  ['04e_szamla', '/szamla/nav-KSZ-2026-028?minta=kata', 1100],
  ['05_tetel', '/tetel/nyugta-okt?minta=fizetendo', 844],
  ['05_tetel_teljes', '/tetel/nyugta-okt?minta=fizetendo', 1900],
  ['06_uzenetek', '/uzenetek?minta=kata', 844],
  ['07_hogyan_jott_ki', '/?minta=fizetendo&lap=hogyan', 844],
  ['07b_hogyan_teljes', '/?minta=fizetendo&lap=hogyan', 1250],
  ['07c_szamlaszamok', '/?minta=fizetendo&lap=szamlaszamok', 1500],
  ['08_befizettem', '/?minta=fizetendo&lap=befizettem', 844],
  ['08_befizettem_allapot', '/?minta=befizetve', 844],
  ['09_fotozas', '/fotozas?minta=kata&demo=1', 844],
  ['09b_feltoltes', '/feltoltes?minta=kata', 1000],
  ['11_ures_dosszie', '/dosszie?minta=ures', 844],
  ['12_keresek', '/keresek?minta=kata', 1000],
  ['12b_keres_uj', '/keresek/uj?minta=kata&tipus=jovedelemigazolas', 1100],
  ['12c_keres_adat', '/keresek/uj?minta=kata&tipus=adatvaltozas', 1000],
  ['13_hataridok', '/hataridok?minta=kata', 1400],
  ['14_ertesitesek', '/ertesitesek?minta=kata', 1000],
  ['15_fiok', '/fiok?minta=kata', 844],
  ['15_fiok_teljes', '/fiok?minta=kata', 1700],
  ['15b_elofizetes', '/fiok/elofizetes?minta=kata', 1400],
  ['15c_dijszamlak', '/fiok/dijszamlak?minta=kata', 1100],
  ['15d_biztonsag', '/fiok/biztonsag?minta=kata', 1300],
  ['15e_ketlepcsos', '/fiok/ketlepcsos?minta=kata', 1300],
  ['15f_ertesites_beallitas', '/fiok/ertesitesek?minta=kata', 1200],
  ['15g_adataim', '/fiok/adataim?minta=kata', 1000],
  ['15h_torles', '/fiok/torles?minta=kata', 1200],
  ['16_gyik', '/gyik?minta=kata', 1500],
  ['16b_jogi', '/jogi/aszf?minta=kata', 900],
  ['17_elofizetes_eredmeny', '/elofizetes/eredmeny?minta=kata&e=SUCCESS&t=501234567', 844],
];

function var_(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  if (!existsSync(join(app, 'dist-minta', 'index.html'))) {
    console.error('Előbb: npm run export:minta');
    process.exit(1);
  }
  const szuro = process.argv.slice(2);
  const lista = LOVESEK.filter(([n]) => !szuro.length || szuro.some((s) => n.startsWith(s)));
  const srv = spawn(process.execPath, [join(app, 'scripts/kiszolgalo.mjs'), join(app, 'dist-minta'), String(PORT)], { stdio: 'ignore' });
  await var_(700);
  try {
    let i = 0;
    const sor = [...lista];
    const egy = async () => {
      while (sor.length) {
        const [nev, ut, magas] = sor.shift();
        const prof = join(tmpdir(), `kezjegy_kep_${process.pid}_${i++}`).replace(/\\/g, '/');
        const cel = join(ki, `${nev}.png`).replace(/\\/g, '/');
        try {
          await futtat(chrome, [
            '--headless=new', '--disable-gpu', '--hide-scrollbars', '--no-first-run', '--no-default-browser-check', '--mute-audio',
            `--user-data-dir=${prof}`, `--window-size=390,${magas}`, '--force-device-scale-factor=2',
            '--virtual-time-budget=12000', '--run-all-compositor-stages-before-draw',
            `--screenshot=${cel}`, `http://127.0.0.1:${PORT}${ut}${ut.includes('?') ? '&' : '?'}szelesseg=390`,
          ], { timeout: 90_000 });
          console.log('kész:', nev);
        } catch (e) {
          console.log('HIBA:', nev, e.message);
        } finally {
          try { rmSync(prof, { recursive: true, force: true }); } catch {}
        }
      }
    };
    await Promise.all(Array.from({ length: Number(process.env.PARHUZAMOS || 4) }, egy));
  } finally {
    srv.kill();
  }
}
main();
