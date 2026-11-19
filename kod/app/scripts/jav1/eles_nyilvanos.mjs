// Live host, PUBLIC pages only (no typing, no login): the deployed builds load without console/CSP errors.
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { rmSync } from 'node:fs';
const puppeteer = createRequire('C:/Users/UpgradePC/konyvelo_app/kod/panel/package.json')('puppeteer-core');
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const var_ = (ms) => new Promise((r) => setTimeout(r, ms));
const LOVESEK = [
  ['eles_app_belepes', 'https://app.45-94-65-74.sslip.io/belepes', 390, 844, 2, 'C:/Users/UpgradePC/konyvelo_app/kod/app/_kepek'],
  ['eles_app_regisztracio', 'https://app.45-94-65-74.sslip.io/regisztracio', 390, 844, 2, 'C:/Users/UpgradePC/konyvelo_app/kod/app/_kepek'],
  ['eles_panel_belepes', 'https://konyvelo.45-94-65-74.sslip.io/belepes', 1280, 720, 1, 'C:/Users/UpgradePC/konyvelo_app/kod/panel/_kepek'],
];
for (const [nev, url, w, h, dpr, ki] of LOVESEK) {
  const prof = join(tmpdir(), `kj_jav1_eles_${process.pid}_${nev}`).replace(/\\/g, '/');
  const b = await puppeteer.launch({ executablePath: chrome, headless: true, userDataDir: prof, args: ['--no-first-run', '--no-default-browser-check', '--mute-audio', '--hide-scrollbars'] });
  try {
    const page = await b.newPage();
    const hibak = [];
    page.on('pageerror', (e) => hibak.push('pageerror: ' + e.message));
    page.on('console', (m) => m.type() === 'error' && hibak.push('console: ' + m.text()));
    page.on('requestfailed', (r) => hibak.push('requestfailed: ' + r.url().slice(0, 120)));
    const rossz = [];
    page.on('response', (r) => { if (r.status() >= 400 && !/\/api\/v1\/(auth\/refresh|me)/.test(r.url())) rossz.push(`${r.status()} ${r.url().slice(0, 110)}`); });
    await page.setViewport({ width: w, height: h, deviceScaleFactor: dpr });
    await page.goto(`${url}${w < 500 ? `?szelesseg=${w}` : ''}`, { waitUntil: 'networkidle0', timeout: 60000 });
    await var_(1500);
    await page.screenshot({ path: `${ki}/jav1_${nev}.png` });
    const szoveg = await page.evaluate(() => document.body.innerText.replace(/\s+/g, ' ').slice(0, 160));
    console.log(`${nev}: ${hibak.length ? 'HIBÁK: ' + hibak.join(' | ').slice(0, 400) : 'nincs konzolhiba'}; ${rossz.length ? '4xx/5xx: ' + rossz.join(' | ') : 'nincs hibás válasz'}; szöveg: ${szoveg}`);
  } catch (e) {
    console.log(`HIBA ${nev}: ${e.message}`);
  } finally {
    await b.close();
    try { rmSync(prof, { recursive: true, force: true }); } catch {}
  }
}
