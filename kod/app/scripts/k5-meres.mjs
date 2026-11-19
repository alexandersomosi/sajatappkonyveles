#!/usr/bin/env node
// SPEC §27.4.5 / K4.5 – „hány telefonképernyő” mérés a MINTA buildön (390 × 844): az útmutató minden lépése, a
// meghatalmazás- és a jóváhagyás-útmutató, a központ, a Főoldal. Csak mér, nem ír semmit.
//   npm run export:minta && node scripts/k5-meres.mjs      PORT=8835
import { spawn } from 'node:child_process';
import { rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(app, '../panel/package.json'));
const puppeteer = require('puppeteer-core');
const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PORT = Number(process.env.PORT || 8835);
const var_ = (ms) => new Promise((r) => setTimeout(r, ms));
const UTAK = [
  ...Array.from({ length: 15 }, (_, i) => [`bejelentés ${i}/14`, `/bekotes/vallalkozas/utmutato?minta=utmutato&lepes=${i}`]),
  ['bejelentés egyben', '/bekotes/vallalkozas/utmutato?minta=utmutato&egyben=1'],
  ...Array.from({ length: 9 }, (_, i) => [`meghatalmazás ${i}/8`, `/bekotes/meghatalmazas?minta=kamara&mod=magam&lepes=${i}`]),
  ...Array.from({ length: 7 }, (_, i) => [`jóváhagyás ${i}/6`, `/bekotes/meghatalmazas/jovahagyas?minta=marika&lepes=${i}`]),
  ['központ (önálló)', '/bekotes/vallalkozas?minta=indul'],
  ['központ (segített)', '/bekotes/vallalkozas?minta=marika'],
  ['Főoldal (Marika)', '/bekotes?minta=marika'],
  ['Főoldal (indul)', '/bekotes?minta=indul'],
];
const srv = spawn(process.execPath, [join(app, 'scripts/kiszolgalo.mjs'), join(app, 'dist-minta'), String(PORT)], { stdio: ['ignore', 'pipe', 'pipe'] });
await new Promise((ok) => srv.stdout.on('data', (d) => String(d).includes('kiszolgáló:') && ok()));
const prof = join(tmpdir(), `kezjegy_k5m_${process.pid}`).replace(/\\/g, '/');
const b = await puppeteer.launch({ executablePath: chrome, headless: true, userDataDir: prof, args: ['--no-first-run', '--hide-scrollbars'] });
try {
  const p = await b.newPage();
  await p.setViewport({ width: 390, height: 844 });
  for (const [nev, ut] of UTAK) {
    await p.goto(`http://127.0.0.1:${PORT}${ut}`, { waitUntil: 'networkidle0', timeout: 60_000 });
    await var_(900);
    const h = await p.evaluate(() => Math.max(...[...document.querySelectorAll('div')].map((d) => (getComputedStyle(d).overflowY === 'auto' || getComputedStyle(d).overflowY === 'scroll' ? d.scrollHeight : 0)), document.body.scrollHeight));
    console.log(`${nev.padEnd(22)} ${(h / 844).toFixed(2)} képernyő`);
  }
} finally {
  await b.close();
  srv.kill();
  try {
    rmSync(prof, { recursive: true, force: true });
  } catch {}
}
