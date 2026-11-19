#!/usr/bin/env node
// Screenshots of every panel page at 1440×900 into _kepek/, from the `--mode mock` build (dist-mock/).
// Uses the locally installed Chrome (puppeteer-core), a fresh --user-data-dir per shot, and a tiny static
// server with SPA fallback. Usage: npm run kepek   (or: node scripts/screenshots.mjs [filter])
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import puppeteer from 'puppeteer-core';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const dist = join(root, 'dist-mock');
const out = join(root, '_kepek');
const tmpBase = (process.env.KEPEK_TMP || join(tmpdir(), 'kezjegy_panel_kepek')).replace(/\\/g, '/');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const filter = process.argv[2] || '';
mkdirSync(out, { recursive: true });
mkdirSync(tmpBase, { recursive: true });

if (!existsSync(join(dist, 'index.html'))) {
  console.error('dist-mock/ hiányzik: előbb `npm run build:mock`');
  process.exit(1);
}

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.woff': 'font/woff', '.json': 'application/json' };
const server = createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  let p = join(dist, decodeURIComponent(u.pathname));
  if (!p.startsWith(dist) || !existsSync(p) || statSync(p).isDirectory()) p = join(dist, 'index.html');
  res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
});
const PORT = Number(process.env.KEPEK_PORT || 4319);
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${PORT}`;

// a tiny valid PDF for the upload shots
const samplePdf = join(tmpBase, 'minta_bankszamlakivonat_oktober.pdf').replace(/\\/g, '/');
writeFileSync(samplePdf, '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj 2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj 3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');

const clickText = (text, sel = 'button, a, label, tr, [role=button]') => async (page) => {
  await page.evaluate(
    (t, s) => {
      const el = [...document.querySelectorAll(s)].find((e) => e.textContent && e.textContent.replace(/\s+/g, ' ').trim().includes(t));
      if (!el) throw new Error('nincs ilyen elem: ' + t);
      el.scrollIntoView({ block: 'center' });
      el.click();
    },
    text,
    sel,
  );
  await new Promise((r) => setTimeout(r, 450));
};
const clickSel = (sel) => async (page) => {
  await page.click(sel);
  await new Promise((r) => setTimeout(r, 450));
};
const upload = (sel, files) => async (page) => {
  const h = await page.$(sel);
  await h.uploadFile(...files);
  await new Promise((r) => setTimeout(r, 450));
};
const type = (sel, text) => async (page) => {
  await page.type(sel, text);
  await new Promise((r) => setTimeout(r, 200));
};

const evalStep = (fn) => async (page) => {
  await page.evaluate(fn);
  await new Promise((r) => setTimeout(r, 450));
};
const A = 'accountant';
const AD = 'admin';
const CS = 'csapat';
const SHOTS = [
  ['01_belepes', 'none', '/belepes'],
  ['02_ugyfelek', A, '/ugyfelek'],
  ['03_ugyfelek_hianyzik_valami', A, '/ugyfelek?szuro=hianyzik_valami'],
  ['04_kata_attekintes', A, '/ugyfelek/c-kata', [], true],
  ['05_peter_bekotes', A, '/ugyfelek/c-peter/bekotes', [], true],
  ['06_peter_azonositas', A, '/ugyfelek/c-peter/bekotes', [clickText('Megnézem')]],
  ['07_kata_dosszie_oktober', A, '/ugyfelek/c-kata/dosszie?ev=2026&honap=2026-10', [], true],
  ['08_kata_irat_reszlet', A, '/ugyfelek/c-kata/dosszie?ev=2026&honap=2026-10', [clickText('Nyugta, készpénzes eladás', 'tr')]],
  ['09_kata_feltoltes_huzd_ide', A, '/ugyfelek/c-kata/dosszie?ev=2026&honap=2026-11', [upload('.ejtozona input[type=file]', [samplePdf])]],
  ['10_kata_nav_szamlak', A, '/ugyfelek/c-kata/nav'],
  ['11_kata_nav_szamla_reszlet', A, '/ugyfelek/c-kata/nav', [clickText('KSZ-2026-031', 'tr')]],
  ['12_kata_bevetelek', A, '/ugyfelek/c-kata/bevetelek', [], true],
  ['13_kata_ado_iv_negyedev', A, '/ugyfelek/c-kata/ado?idoszak=2026-Q4', [], true],
  ['14_kata_ado_jovahagyas_kerdes', A, '/ugyfelek/c-kata/ado?idoszak=2026-Q4', [clickText('Jóváhagyom és elküldöm')]],
  ['15_kata_ado_jovahagyva', A, '/ugyfelek/c-kata/ado?idoszak=2026-Q4', [clickText('Jóváhagyom és elküldöm'), clickText('Igen, jóváhagyom és elküldöm')], true],
  ['16_kata_ado_iii_beadva', A, '/ugyfelek/c-kata/ado?idoszak=2026-Q3', [], true],
  ['17_reka_ado_befizetes_ellenorzes', A, '/ugyfelek/c-reka/ado', [], true],
  ['18_kata_uzenetek', A, '/ugyfelek/c-kata/uzenetek'],
  ['19_kata_keresek', A, '/ugyfelek/c-kata/keresek'],
  ['20_kata_uj_keres', A, '/ugyfelek/c-kata/keresek?uj=1', [clickText('Töltsd fel az októberi', '.fiok-lap button')]],
  ['21_kata_naplo', A, '/ugyfelek/c-kata/naplo'],
  ['22_reka_attekintes_hatar', A, '/ugyfelek/c-reka'],
  ['23_hatarido_figyelo', A, '/hatarido-figyelo'],
  ['24_keresek_sor', A, '/keresek'],
  ['25_keresek_igazolas_kezelese', A, '/keresek?szuro=igazolas', [clickText('Jövedelemigazolás, 2025', 'tr')]],
  ['26_sablonok', A, '/sablonok'],
  ['28_export', A, '/export'],
  ['29_naplo', A, '/naplo'],
  ['30_beallitasok', A, '/beallitasok', [], true],
  ['31_ketlepcsos_bekapcsolas', A, '/beallitasok', [clickText('Bekapcsolom', 'button')]],
  ['40_admin_attekintes', AD, '/admin', [], true],
  ['41_admin_ugyfelek', AD, '/admin/ugyfelek'],
  ['42_admin_elofizetesek', AD, '/admin/elofizetesek'],
  ['43_admin_fizetesek_sikertelen', AD, '/admin/fizetesek'],
  ['44_admin_konyvelok', AD, '/admin/konyvelok'],
  ['45_admin_konyvelo_meghivas', AD, '/admin/konyvelok', [clickText('Könyvelő meghívása')]],
  ['46_admin_forrasok', AD, '/admin/forrasok', [], true],
  ['47_admin_gyik', AD, '/admin/szovegek'],
  ['48_admin_ertesites_szerkeszto', AD, '/admin/szovegek?ful=szovegek', [clickText('Jóváhagyott fizetendő – értesítés szövege', 'tr')]],
  ['49_admin_naplo', AD, '/admin/naplo'],
  ['50_admin_demo_postafiok', AD, '/admin/demo-postafiok'],
  ['51_admin_rendszer', AD, '/admin/rendszer'],
  // SPEC §26 (owner orders 11-18): service team (csapat), callbacks, new-business pipeline – k3_*
  ['k3_01_csapat_visszahivasok', CS, '/visszahivasok'],
  ['k3_02_visszahivas_gazdatlan', CS, '/visszahivasok?nyit=cb-levente'],
  ['k3_03_visszahivas_magamra_vettem', CS, '/visszahivasok?nyit=cb-levente', [clickText('Magamra veszem', '.fiok-lap button')]],
  ['k3_04_hivas_eredmenye', CS, '/visszahivasok?nyit=cb-reka', [clickText('Hívás eredménye', '.fiok-lap button'), clickText('Beszéltünk', '.fiok-lap label')]],
  ['k3_05_visszahivas_atadas', CS, '/visszahivasok?nyit=cb-reka', [clickText('Átadom', '.fiok-lap button')]],
  ['k3_06_vallalkozas_inditas_tabla', CS, '/vallalkozas-inditas', [], true],
  ['k3_07_levente_ellenorzesre_var', CS, '/vallalkozas-inditas/reg-levente', [], true],
  ['k3_08_levente_minden_pipa', CS, '/vallalkozas-inditas/reg-levente', [evalStep(() => document.querySelectorAll('.lap input[type=checkbox]:not(:checked)').forEach((e) => e.click()))], true],
  ['k3_09_javitast_kerek', CS, '/vallalkozas-inditas/reg-levente', [clickText('Javítást kérek')]],
  ['k3_10_mark_javitasra_var', CS, '/vallalkozas-inditas/reg-mark', [], true],
  ['k3_11_viktor_adoszam_figyelmeztetes', CS, '/vallalkozas-inditas/reg-viktor', [type('input[placeholder="12345678-1-23"]', '12345676-2-13')]],
  ['k3_12_zsofia_adatok_javitasa', CS, '/vallalkozas-inditas/reg-zsofia', [clickText('Javítom')]],
  ['k3_13_csapat_uzenetek', CS, '/uzenetek/c-levente'],
  ['k3_14_csapat_beallitasok', CS, '/beallitasok'],
  ['k3_20_admin_attekintes', AD, '/admin', [], true],
  ['k3_21_admin_csapat', AD, '/admin/csapat'],
  ['k3_22_admin_uj_munkatars', AD, '/admin/csapat', [clickText('Új munkatárs')]],
  ['k3_23_admin_visszahivasok_mind', AD, '/visszahivasok?szuro=mind'],
  ['k3_30_konyvelo_visszahivasok', A, '/visszahivasok'],
  ['k3_31_konyvelo_visszahivas_reszlet', A, '/visszahivasok?nyit=cb-eszter'],
  ['k3_32_peter_visszahivasok_ful', A, '/ugyfelek/c-peter/visszahivasok'],
  ['k3_33_levente_bekotes', A, '/ugyfelek/c-levente/bekotes', [], true],
  ['k3_34_peter_kyc_lakcimkartya_csak_cimoldal', A, '/ugyfelek/c-peter/bekotes', [clickText('Megnézem')]],
  ['k3_35_ugyfelek_bekotes_alatt', A, '/ugyfelek?szuro=bekotes_alatt'],
  ['k3_36_beallitasok_idopont_nelkul', A, '/beallitasok'],
  ['k3_37_idopontok_atiranyitas', A, '/idopontok'],
  // SPEC §27 (owner orders 11-19): "Intézzük helyette", changeable branch, admin block, invoice wording – k5_*
  ['k5_01_csapat_helyettunk_sor', CS, '/helyettunk', [], true],
  ['k5_02_ilona_hivasra_var', CS, '/helyettunk/as-ilona', [], true],
  ['k5_03_marika_jovahagyasra_var_csapat', CS, '/helyettunk/as-marika', [], true],
  ['k5_04_visszahivas_ilona_banner', CS, '/visszahivasok?nyit=cb-ilona'],
  [
    'k5_05_visszahivas_ilona_beszeltunk_lista',
    CS,
    '/visszahivasok?nyit=cb-ilona',
    [
      clickText('Magamra veszem', '.fiok-lap button'),
      clickText('Hívás eredménye', '.fiok-lap button'),
      clickText('Beszéltünk', '.fiok-lap label'),
      clickText('Rögzítem a hívást', '.fiok-lap button'),
      evalStep(() => document.querySelectorAll('.fiok-lap input[type=checkbox]:not(:checked)').forEach((e) => e.click())),
    ],
  ],
  ['k5_06_visszahivas_keri_helyettunk', CS, '/visszahivasok?nyit=cb-zsofia', [clickText('Kéri, hogy intézzük helyette?', '.fiok-lap button'), clickText('Vállalkozás bejelentése', '.fiok-lap label')]],
  ['k5_07_visszahivas_utvonal_modositasa', CS, '/visszahivasok?nyit=cb-zsofia', [clickText('Útvonal módosítása', '.fiok-lap button'), type('.fiok-lap textarea', 'Telefonon kiderült: 2019 óta egyéni vállalkozó, csak rossz gombot nyomott.')]],
  ['k5_08_vallalkozas_inditas_tabla', CS, '/vallalkozas-inditas', [evalStep(() => document.querySelectorAll('details').forEach((d) => (d.open = true)))], true],
  ['k5_09_vallalkozas_inditas_csak_helyettunk', CS, '/vallalkozas-inditas?mod=segitett'],
  ['k5_10_regisztracio_marika_segitett', CS, '/vallalkozas-inditas/reg-marika', [], true],
  ['k5_11_regisztracio_gergely_utvonalvaltas', CS, '/vallalkozas-inditas/reg-gergely', [], true],
  ['k5_12_helyettunk_lili_lezaras', CS, '/helyettunk/as-lili', [clickText('Lezárom', 'button'), clickText('Nem értük el', '.fiok-lap label')]],
  ['k5_13_helyettunk_lili_lejart', CS, '/helyettunk/as-lili', [], true],
  ['k5_20_konyvelo_helyettunk_sor', A, '/helyettunk'],
  ['k5_21_konyvelo_david_ujegyke', A, '/helyettunk/as-david', [], true],
  ['k5_22_konyvelo_david_minden_pipa', A, '/helyettunk/as-david', [evalStep(() => document.querySelectorAll('.fazis.aktiv input[type=checkbox]:not(:checked):not(:disabled)').forEach((e) => e.click()))], true],
  ['k5_23_konyvelo_timea_bejelentes', A, '/helyettunk/as-timea', [clickText('Mutasd', 'button')], true],
  ['k5_24_konyvelo_marika_idozito', A, '/helyettunk/as-marika', [], true],
  ['k5_25_konyvelo_david_bekotes_ful', A, '/ugyfelek/c-david/bekotes', [], true],
  ['k5_26_konyvelo_kata_dosszie_kiallitott', A, '/ugyfelek/c-kata/dosszie', [], true],
  ['k5_27_konyvelo_kezikonyv', A, '/helyettunk/as-timea', [clickText('Így küldd be meghatalmazottként', 'summary')], true],
  ['k5_28_konyvelo_marika_bekotes_ful', A, '/ugyfelek/c-marika/bekotes', [], true],
  ['k5_30_admin_attekintes', AD, '/admin', [], true],
  ['k5_31_admin_ugyfel_letiltasa', AD, '/admin/ugyfelek', [clickText('Fiók letiltása', 'button')]],
  ['k5_32_admin_helyettunk_mind', AD, '/helyettunk?szuro=mind'],
  ['k5_33_admin_szovegek', AD, '/admin/szovegek?ful=szovegek'],
  ['k5_34_konyvelo_ertesitesek', A, '/helyettunk', [clickText('Értesítések', 'button')]],
  ['k5_35_csapat_marika_regisztracio_ugyfel', CS, '/vallalkozas-inditas/reg-timea', [], true],
];

let n = 0;
const fails = [];
for (const [nev, role, path, steps = [], full = false] of SHOTS) {
  // filter: one or more comma-separated name parts
  if (filter && !filter.split(',').some((f) => nev.includes(f))) continue;
  const udd = `${tmpBase}/udd_${nev}_${Date.now()}`;
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: true,
    userDataDir: udd,
    args: ['--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--force-device-scale-factor=1', '--lang=hu-HU'],
    defaultViewport: { width: 1440, height: 900, deviceScaleFactor: 1 },
    protocolTimeout: 180000,
  });
  const watchdog = setTimeout(() => {
    fails.push(`${nev}: időtúllépés (240 s)`);
    browser.process()?.kill('SIGKILL');
  }, 240000);
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
    const sep = path.includes('?') ? '&' : '?';
    // 'load' + a short network-idle wait: on a busy machine networkidle0 alone can miss its 30 s window.
    await page.goto(`${BASE}${path}${sep}mock_role=${role}`, { waitUntil: 'load', timeout: 120000 });
    await page.waitForNetworkIdle({ idleTime: 500, timeout: 30000 }).catch(() => {});
    await page.evaluate(() => document.fonts.ready);
    await page.waitForFunction(() => !document.querySelector('.betoltes'), { timeout: 10000 }).catch(() => {});
    await new Promise((r) => setTimeout(r, 350));
    for (const s of steps) await s(page);
    await page.waitForFunction(() => !document.querySelector('.betoltes'), { timeout: 10000 }).catch(() => {});
    await page.evaluate(() => window.scrollTo(0, 0));
    await new Promise((r) => setTimeout(r, 250));
    await page.screenshot({ path: join(out, `${nev}.png`).replace(/\\/g, '/') });
    if (full) await page.screenshot({ path: join(out, `${nev}_teljes.png`).replace(/\\/g, '/'), fullPage: true });
    if (errors.length) fails.push(`${nev}: ${errors.join(' | ')}`);
    n++;
    console.log('ok', nev);
  } catch (e) {
    fails.push(`${nev}: ${e.message}`);
    console.log('HIBA', nev, e.message);
  } finally {
    clearTimeout(watchdog);
    await browser.close().catch(() => {});
  }
}
server.close();
console.log(`${n} kép kész: ${out}`);
if (fails.length) {
  console.log('Hibák / konzolhibák:\n' + fails.join('\n'));
  process.exitCode = 1;
}
