#!/usr/bin/env node
// k8 (FELÜLET-P): a v2 kinézet képei a fő oldalakról, 1440 és 1280 px szélességben, a mock buildből.
//   npx vite build --mode mock --outDir dist-mock-k8p && node scripts/kepek-k8.mjs
// Környezet: KEPEK_DIST (alap: dist-mock-k8p), KEPEK_KI (alap: _munka/k8/panel_minta), KEPEK_ELO (fájlnév-előtag, alap: ''),
// KEPEK_SZELEK (alap: 1440,1280), KEPEK_PORT (alap: 4361). Első argumentum: szűrő (a név része, vesszővel több).
// Lövésenként saját --user-data-dir (a gép Chrome-ja, puppeteer-core), mint a screenshots.mjs.
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import puppeteer from 'puppeteer-core';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const dist = resolve(root, process.env.KEPEK_DIST || 'dist-mock-k8p');
const out = resolve(root, process.env.KEPEK_KI || '../../_munka/k8/panel_minta');
const elo = process.env.KEPEK_ELO || '';
const SZELEK = (process.env.KEPEK_SZELEK || '1440,1280').split(',').map(Number);
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const tmpBase = join(tmpdir(), 'kezjegy_panel_kepek_k8').replace(/\\/g, '/');
const filter = process.argv[2] || '';
mkdirSync(out, { recursive: true });
mkdirSync(tmpBase, { recursive: true });
if (!existsSync(join(dist, 'index.html'))) {
  console.error(`${dist} hiányzik: előbb npx vite build --mode mock --outDir ${process.env.KEPEK_DIST || 'dist-mock-k8p'}`);
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
const PORT = Number(process.env.KEPEK_PORT || 4361);
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${PORT}`;
const varj = (ms) => new Promise((r) => setTimeout(r, ms));
const kattint = (t, sel = 'button, a, label, tr, summary') => async (page) => {
  await page.evaluate(
    (t, s) => {
      const el = [...document.querySelectorAll(s)].find((e) => e.textContent && e.textContent.replace(/\s+/g, ' ').trim().includes(t));
      if (!el) throw new Error('nincs ilyen elem: ' + t);
      el.scrollIntoView({ block: 'center' });
      el.click();
    },
    t,
    sel,
  );
  await varj(500);
};
/** Görget egy elemhez (a képen ez legyen felül), pl. az átutalás-szakasz a konzolon. */
const gorget = (sel) => async (page) => {
  await page.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el) throw new Error('nincs ilyen elem: ' + s);
    el.scrollIntoView({ block: 'start' });
    window.scrollBy(0, -16);
  }, sel);
  await varj(300);
};

const A = 'accountant';
const AD = 'admin';
const CS = 'csapat';
// [név, szerep, útvonal, lépések, teljes oldal is?, görgetés a lépések után (ne ugorjon vissza a tetejére)]
const SHOTS = [
  ['p00_belepes', 'none', '/belepes'],
  // könyvelő
  ['p01_ugyfellista', A, '/ugyfelek', [], true],
  ['p02_ugyfel_adatlap', A, '/ugyfelek/c-kata', [], true],
  ['p03_ado', A, '/ugyfelek/c-kata/ado?idoszak=2026-Q4', [], true],
  ['p03b_ado_kata', A, '/ugyfelek/c-lakatos-greta/ado', [], true],
  ['p04_eves_zaras', A, '/ugyfelek/c-kata/eves?mock_today=2027-03-20', [], true],
  ['p05_uzenetek', A, '/ugyfelek/c-kata/uzenetek'],
  ['p06_dosszie', A, '/ugyfelek/c-kata/dosszie?ev=2026&honap=2026-10', [], true],
  ['p07_hatarido_figyelo', A, '/hatarido-figyelo'],
  ['p08_eves_attekinto', A, '/eves-attekinto', [], true],
  ['p09_keresek', A, '/keresek'],
  ['p10_fiok_lap', A, '/ugyfelek/c-kata/dosszie?ev=2026&honap=2026-10', [kattint('Nyugta, készpénzes eladás', 'tr')]],
  ['p11_csapat_visszahivasok', CS, '/visszahivasok'],
  ['p12_vallalkozas_inditas', CS, '/vallalkozas-inditas'],
  // konzol / vezérlőpult (tulaj)
  ['k01_konzol_attekintes', AD, '/admin/konzol', [], true],
  ['k02_elofizetesek', AD, '/admin/elofizetesek'],
  ['k03_fizetesek', AD, '/admin/fizetesek?szuro=mind'],
  ['k04_atutalas_allapot', AD, '/admin/konzol', [gorget('#atutalas')], false, true],
  ['k05_marketing', AD, '/admin/marketing', [], true],
  ['k06_rendszer', AD, '/admin/rendszer', [], true],
  ['k07_admin_attekintes', AD, '/admin', [], true],
  ['k08_konzol_ugyfelek', AD, '/admin/konzol/ugyfelek'],
  ['k08b_konzol_ugyfelkartya', AD, '/admin/konzol/ugyfelek/cl-tr-2', [], true],
  ['k03b_fizetesek_atutalas', AD, '/admin/fizetesek?szuro=atutalas', [], true],
  ['k09_dijszamlak', AD, '/admin/dijszamlak'],
  // további oldalak szemrevételezéshez (nem a fő lista): KEPEK_SZELEK=1440 node scripts/kepek-k8.mjs x
  ['x01_bekotes', A, '/ugyfelek/c-peter/bekotes', [], true],
  ['x02_kedvezmenyek', A, '/ugyfelek/c-szabo-eszter/kedvezmenyek', [], true],
  ['x03_helyettunk_reszlet', A, '/helyettunk/as-david', [], true],
  ['x04_regisztracio', CS, '/vallalkozas-inditas/reg-levente', [], true],
  ['x05_beallitasok', A, '/beallitasok', [], true],
  ['x06_dijak', AD, '/admin/dijak', [], true],
  ['x07_csapat_uzenetek', CS, '/uzenetek/c-levente'],
  ['x08_havi_valtozasok', A, '/havi-valtozasok'],
  ['x09_ado_jovahagyas_kerdes', A, '/ugyfelek/c-kata/ado?idoszak=2026-Q4', [kattint('Jóváhagyom és elküldöm')]],
  ['x10_szovegek', AD, '/admin/szovegek?ful=szovegek'],
];

let n = 0;
const fails = [];
for (const SZEL of SZELEK) {
  for (const [nev, role, path, steps = [], full = false, maradjon = false] of SHOTS) {
    if (filter && !filter.split(',').some((f) => nev.includes(f))) continue;
    const udd = `${tmpBase}/udd_${nev}_${SZEL}_${Date.now()}`;
    const browser = await puppeteer.launch({
      executablePath: CHROME,
      headless: true,
      userDataDir: udd,
      args: ['--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--force-device-scale-factor=1', '--lang=hu-HU'],
      defaultViewport: { width: SZEL, height: 900, deviceScaleFactor: 1 },
      protocolTimeout: 180000,
    });
    const watchdog = setTimeout(() => {
      fails.push(`${nev}_${SZEL}: időtúllépés (240 s)`);
      browser.process()?.kill('SIGKILL');
    }, 240000);
    try {
      const page = await browser.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
      const sep = path.includes('?') ? '&' : '?';
      await page.goto(`${BASE}${path}${sep}mock_role=${role}`, { waitUntil: 'load', timeout: 120000 });
      await page.waitForNetworkIdle({ idleTime: 500, timeout: 30000 }).catch(() => {});
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => !document.querySelector('.betoltes'), { timeout: 10000 }).catch(() => {});
      await varj(350);
      for (const s of steps) await s(page);
      await page.waitForFunction(() => !document.querySelector('.betoltes'), { timeout: 10000 }).catch(() => {});
      await page.waitForNetworkIdle({ idleTime: 400, timeout: 10000 }).catch(() => {});
      if (!maradjon) await page.evaluate(() => window.scrollTo(0, 0));
      await varj(300);
      // a fejléc nélküli oldalaknál is legyen vízszintes görgetés-ellenőrzés: ha a lap szélesebb, jelezzük
      const szeles = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      if (szeles > 0) fails.push(`${nev}_${SZEL}: vízszintesen görgethető (${szeles} px)`);
      const fajl = join(out, `${elo}${nev}_${SZEL}.png`).replace(/\\/g, '/');
      await page.screenshot({ path: fajl });
      if (full) await page.screenshot({ path: fajl.replace(/\.png$/, '_teljes.png'), fullPage: true });
      if (errors.length) fails.push(`${nev}_${SZEL}: ${errors.join(' | ')}`);
      n++;
      console.log('ok', `${elo}${nev}_${SZEL}`);
    } catch (e) {
      fails.push(`${nev}_${SZEL}: ${e.message}`);
      console.log('HIBA', nev, SZEL, e.message);
    } finally {
      clearTimeout(watchdog);
      await browser.close().catch(() => {});
    }
  }
}
server.close();
console.log(`${n} kép kész: ${out}`);
if (fails.length) {
  console.log('Hibák / figyelmeztetések:\n' + fails.join('\n'));
  process.exitCode = 1;
}
