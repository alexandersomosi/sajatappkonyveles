// A html/*.html vázlatképernyők kirajzolása: png/<név>.png (412 CSS px széles, 5x = 2060 px)
// és png/<név>.json: a data-jel="…" elemek helye eszköz-pixelben [x0, y0, x1, y1].
// Kell hozzá a puppeteer-core (a panel node_modules-ából) és a Chrome.  Futtatás: node render.mjs
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath, pathToFileURL } from 'url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire('C:/Users/UpgradePC/konyvelo_app/kod/panel/package.json');
const puppeteer = require('puppeteer-core');
const DPR = 5;
const src = path.join(HERE, 'html');
const out = path.join(HERE, 'png');
fs.mkdirSync(out, { recursive: true });
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new',
  userDataDir: path.join(os.tmpdir(), 'kezjegy_illusztracio_' + Date.now()), args: ['--disable-gpu', '--allow-file-access-from-files'],
});
const page = await browser.newPage();
await page.setViewport({ width: 412, height: 900, deviceScaleFactor: DPR });
for (const f of fs.readdirSync(src).filter((x) => x.endsWith('.html')).sort()) {
  const nev = f.replace(/\.html$/, '');
  await page.goto(pathToFileURL(path.join(src, f)).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const h = await page.evaluate(() => Math.ceil(document.body.getBoundingClientRect().height));
  await page.setViewport({ width: 412, height: h, deviceScaleFactor: DPR });
  const helyek = await page.evaluate((dpr) => Object.fromEntries([...document.querySelectorAll('[data-jel]')].map((e) => {
    const r = e.getBoundingClientRect();
    return [e.dataset.jel, [r.left, r.top, r.right, r.bottom].map((v) => Math.round(v * dpr))];
  })), DPR);
  await page.screenshot({ path: path.join(out, nev + '.png'), fullPage: true });
  fs.writeFileSync(path.join(out, nev + '.json'), JSON.stringify({ nev, dpr: DPR, szel: 412 * DPR, mag: h * DPR, helyek }, null, 1), 'utf8');
  console.log(nev, 412 * DPR, 'x', h * DPR, Object.keys(helyek).length, 'jel');
}
await browser.close();
