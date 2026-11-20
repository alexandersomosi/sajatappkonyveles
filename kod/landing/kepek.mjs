#!/usr/bin/env node
// Képernyőképek az adozz.hu nyitóoldalról (kod/landing/dist): 390, 320 (@2x) és 1280 → kod/_qa/k7_landing_*.png.
// Fej nélküli Chrome (puppeteer-core a kod/panel-ből), saját --user-data-dir.   node kod/landing/kepek.mjs
import { mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ITT = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(ITT, '../panel/package.json'));
const puppeteer = require('puppeteer-core');
const ki = resolve(ITT, '../_qa');
mkdirSync(ki, { recursive: true });
const url = pathToFileURL(join(ITT, 'dist/index.html')).href;
const prof = join(tmpdir(), `kezjegy_landing_${process.pid}`);
const b = await puppeteer.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, userDataDir: prof, args: ['--no-first-run', '--hide-scrollbars'] });
try {
  for (const [w, h, dsf] of [[390, 844, 2], [320, 640, 2], [1280, 800, 1]]) {
    const p = await b.newPage();
    await p.setViewport({ width: w, height: h, deviceScaleFactor: dsf });
    await p.goto(url, { waitUntil: 'networkidle0' });
    await new Promise((r) => setTimeout(r, 400));
    const tul = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    await p.screenshot({ path: join(ki, `k7_landing_${w}.png`), fullPage: true });
    console.log(`kész: k7_landing_${w}.png${tul ? ' (VÍZSZINTES GÖRGETÉS!)' : ''}`);
    await p.close();
  }
} finally {
  await b.close();
  rmSync(prof, { recursive: true, force: true });
}
