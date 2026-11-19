#!/usr/bin/env node
// 11-19 javító kör 2 – a panel képei a HELYI próbán (panel dev szerver → scripts/_helyi_j2.mjs). A seed-jelszót a helyi
// próba ideiglenes fájljából olvassuk (csak 127.0.0.1-en, kitalált demo-fiók), a konzolra nem írjuk ki.
//   PANEL=http://127.0.0.1:5191 CRED=<a helyi próba demo_belepesek.txt-je> node scripts/_panel_j2.mjs
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(app, '../panel/package.json'));
const puppeteer = require('puppeteer-core');
const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const PANEL = process.env.PANEL || 'http://127.0.0.1:5191';
const ki = resolve(app, '..', '_qa');
const var_ = (ms) => new Promise((r) => setTimeout(r, ms));
const sor = readFileSync(process.env.CRED, 'utf8').split('\n').find((s) => s.includes(';anna.'));
const [, email, jelszo] = sor.trim().split(';');

const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new', userDataDir: join(tmpdir(), `kj_panel_j2_${Date.now()}`), args: ['--disable-gpu', '--no-first-run', '--lang=hu-HU'] });
const lo = async (p, nev) => {
  await var_(700);
  await p.screenshot({ path: join(ki, `j2_panel_${nev}.png`), fullPage: true });
  console.log('kép:', `j2_panel_${nev}.png`);
};
try {
  const p = await browser.newPage();
  await p.setViewport({ width: 1440, height: 900 });
  await p.goto(`${PANEL}/`, { waitUntil: 'networkidle0' });
  await var_(800);
  await p.type('input[type=email], input[name=email]', email, { delay: 5 });
  await p.type('input[type=password]', jelszo, { delay: 5 });
  await p.keyboard.press('Enter');
  await var_(2500);
  await p.goto(`${PANEL}/vallalkozas-inditas`, { waitUntil: 'networkidle0' });
  await var_(1500);
  // a lenyitható „Elállt vagy útvonalat váltott” rész kinyitása
  await p.evaluate(() => document.querySelectorAll('details').forEach((d) => (d.open = true)));
  await lo(p, '01_vallalkozas_inditas');
  const linkek = await p.$$eval('a[href^="/vallalkozas-inditas/"]', (as) => as.map((a) => a.getAttribute('href')));
  if (linkek.length) {
    await p.goto(`${PANEL}${linkek[0]}`, { waitUntil: 'networkidle0' });
    await var_(1500);
    await lo(p, '02_regisztracio_kovetkezik');
    console.log('szöveg:', (await p.evaluate(() => document.body.innerText)).split('\n').filter((x) => /most ez jön|következik|várunk|Útvonalat váltott|Elállt/.test(x)).slice(0, 6));
  }
  await p.goto(`${PANEL}/helyettunk`, { waitUntil: 'networkidle0' });
  await var_(1500);
  await lo(p, '03_helyettunk_lista');
} catch (e) {
  console.log('HIBA:', e.message);
} finally {
  await browser.close();
}
