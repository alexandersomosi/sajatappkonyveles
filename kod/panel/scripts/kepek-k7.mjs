#!/usr/bin/env node
// SPEC §29.1.14 (k7, B3) panel képek: Előfizetések, Fizetések (+ visszatérítés, a kódos megerősítés), Díjszámlák,
// Rendszer, Díjak – a mock buildből (dist-mock-k7b3), 1440 és 1280 px, lövésenként saját --user-data-dir → kod/_qa/k7_panel_*.png
//   npx vite build --mode mock --outDir dist-mock-k7b3 && node scripts/kepek-k7.mjs      (port: KEPEK_PORT=4351)
import { createServer } from 'node:http';
import { existsSync, mkdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import { extname, join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import puppeteer from 'puppeteer-core';

const here = dirname(fileURLToPath(import.meta.url));
const root = resolve(here, '..');
const dist = join(root, 'dist-mock-k7b3');
const out = resolve(root, '../_qa');
const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
mkdirSync(out, { recursive: true });
if (!existsSync(join(dist, 'index.html'))) throw new Error('Előbb: npx vite build --mode mock --outDir dist-mock-k7b3');

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.woff2': 'font/woff2', '.json': 'application/json' };
const server = createServer((req, res) => {
  const u = new URL(req.url, 'http://x');
  let p = join(dist, decodeURIComponent(u.pathname));
  if (!p.startsWith(dist) || !existsSync(p) || statSync(p).isDirectory()) p = join(dist, 'index.html');
  res.writeHead(200, { 'Content-Type': TYPES[extname(p)] || 'application/octet-stream' });
  res.end(readFileSync(p));
});
const PORT = Number(process.env.KEPEK_PORT || 4351);
await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
const BASE = `http://127.0.0.1:${PORT}`;
const var_ = (ms) => new Promise((r) => setTimeout(r, ms));
const kattint = (t, sel = 'button, a, label, tr') => async (page) => {
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
  await var_(500);
};
const gepel = (sel, t) => async (page) => {
  await page.type(sel, t);
  await var_(200);
};

const SHOTS = [
  ['k7_panel_01_elofizetesek', '/admin/elofizetesek'],
  ['k7_panel_02_fizetesek_gond', '/admin/fizetesek'],
  ['k7_panel_02b_fizetesek_mind', '/admin/fizetesek?szuro=mind'],
  ['k7_panel_03_visszaterites', '/admin/fizetesek?szuro=mind', [kattint('Visszatérítés', 'button')]],
  ['k7_panel_03b_kodos_megerosites', '/admin/fizetesek?szuro=mind', [kattint('Visszatérítés', 'button'), gepel('.fiok-lap input:not([inputmode])', 'Az ügyfél kérte, dupla rendelés'), kattint('Megerősítem', 'button')]],
  ['k7_panel_04_dijszamlak', '/admin/dijszamlak'],
  ['k7_panel_04b_dijszamlak_hiba', '/admin/dijszamlak?status=hiba'],
  ['k7_panel_05_rendszer', '/admin/rendszer'],
  ['k7_panel_06_dijak', '/admin/dijak'],
];
const fails = [];
for (const szel of [1440, 1280]) {
  for (const [nev, path, steps = []] of SHOTS) {
    const udd = join(tmpdir(), `kezjegy_panel_k7b3_${process.pid}_${nev}_${szel}`);
    const b = await puppeteer.launch({ executablePath: CHROME, headless: true, userDataDir: udd, args: ['--no-first-run', '--hide-scrollbars', '--lang=hu-HU'], defaultViewport: { width: szel, height: 900, deviceScaleFactor: 1 } });
    try {
      const page = await b.newPage();
      const errors = [];
      page.on('pageerror', (e) => errors.push(String(e)));
      await page.goto(`${BASE}${path}${path.includes('?') ? '&' : '?'}mock_role=admin`, { waitUntil: 'load', timeout: 120000 });
      await page.waitForNetworkIdle({ idleTime: 500, timeout: 30000 }).catch(() => {});
      await page.evaluate(() => document.fonts.ready);
      await var_(500);
      for (const s of steps) await s(page);
      await var_(400);
      await page.screenshot({ path: join(out, `${nev}_${szel}.png`).replace(/\\/g, '/') });
      if (errors.length) fails.push(`${nev}: ${errors.join(' | ')}`);
      console.log('ok', nev, szel);
    } catch (e) {
      fails.push(`${nev}_${szel}: ${e.message}`);
      console.log('HIBA', nev, szel, e.message);
    } finally {
      await b.close().catch(() => {});
      rmSync(udd, { recursive: true, force: true });
    }
  }
}
server.close();
if (fails.length) console.log('Hibák:\n' + fails.join('\n'));
