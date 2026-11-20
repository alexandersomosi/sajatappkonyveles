#!/usr/bin/env node
// k7c3 – after k7c3-kepek.mjs: Kerekes Anna's Fiók → Díjak és számlák scrolled to the payments, and Fiók → Előfizetés.
//   BASE=http://127.0.0.1:8937 node scripts/k7c3-kepek2.mjs   → kod/_qa/k7c3_fizetés_1*.png
import { writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(app, '../panel/package.json'));
const puppeteer = require('puppeteer-core');
const BASE = process.env.BASE || 'http://127.0.0.1:8937';
const ki = resolve(app, '..', '_qa');
const var_ = (ms) => new Promise((r) => setTimeout(r, ms));
const eredmeny = [];

async function gorgetve(page, elotag) {
  // the RN-web screen scrolls inside its own container: screenshot it page by page
  const lepes = await page.evaluate(() => {
    const s = [...document.querySelectorAll('div')].filter((d) => d.scrollHeight > d.clientHeight + 40 && getComputedStyle(d).overflowY !== 'visible').sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
    if (!s) return 0;
    s.setAttribute('data-k7c3', '1');
    return Math.ceil((s.scrollHeight - s.clientHeight) / (s.clientHeight * 0.8));
  });
  for (let i = 0; i <= lepes; i++) {
    await page.evaluate((i) => {
      const s = document.querySelector('[data-k7c3="1"]');
      if (s) s.scrollTop = i * s.clientHeight * 0.8;
    }, i);
    await var_(900);
    const nev = `${elotag}_${String(i + 1).padStart(2, '0')}`;
    await page.screenshot({ path: join(ki, `k7c3_fizetés_${nev}.png`) });
    eredmeny.push({ nev, szoveg: await page.evaluate(() => document.body.innerText.slice(0, 6000)) });
    console.log(`kép: k7c3_fizetés_${nev}`);
  }
}

const b = await puppeteer.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, userDataDir: join(tmpdir(), `kezjegy_k7c3b_${process.pid}`), args: ['--no-first-run', '--hide-scrollbars'] });
try {
  const page = await b.newPage();
  await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
  await page.goto(`${BASE}/__helyi/belep?ki=${encodeURIComponent('auth+anna')}&ide=/fiok/dijak`, { waitUntil: 'networkidle0', timeout: 60_000 });
  await var_(2500);
  await gorgetve(page, '10_anna_dijak');
  await page.goto(`${BASE}/fiok/elofizetes`, { waitUntil: 'networkidle0', timeout: 60_000 });
  await var_(2500);
  await gorgetve(page, '11_anna_elofizetes');
} finally {
  await b.close();
}
writeFileSync(join(ki, 'k7c3', 'k7c3_kepek2_eredmeny.json'), JSON.stringify(eredmeny, null, 2));
