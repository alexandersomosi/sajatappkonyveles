// Képernyőkép az asztali mintákról: node kep_asztali.cjs [--szel=1280] fajl1.html [fajl2.html ...]
// Alapból 1440 px széles, 1x, teljes magasság; a PNG a HTML mellé kerül, azonos névvel.
// --szel=1280: más szélesség (kisebb laptop-próba), ilyenkor a PNG neve fajl_1280.png.
const path = require('path');
const { pathToFileURL } = require('url');
const fs = require('fs');
const puppeteer = require('C:/Users/UpgradePC/konyvelo_app/kod/panel/node_modules/puppeteer-core');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(f => fs.existsSync(f));
const szelArg = process.argv.find(a => a.startsWith('--szel='));
const W = szelArg ? parseInt(szelArg.slice(7), 10) : 1440;
(async () => {
  const files = process.argv.slice(2).filter(a => !a.startsWith('--'));
  if (!files.length) { console.error('Használat: node kep_asztali.cjs oldal.html ...'); process.exit(2); }
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars', '--allow-file-access-from-files'] });
  let hiba = 0;
  for (const f of files) {
    const abs = path.resolve(f);
    const page = await browser.newPage();
    const naplo = [];
    page.on('console', m => { if (m.type() === 'error') naplo.push(m.text()); });
    page.on('requestfailed', r => naplo.push('BETÖLTÉSI HIBA: ' + r.url()));
    await page.setViewport({ width: W, height: 900, deviceScaleFactor: 1 });
    await page.goto(pathToFileURL(abs).href, { waitUntil: 'networkidle0', timeout: 30000 }).catch(e => naplo.push('goto: ' + e.message));
    await page.evaluate(() => document.fonts && document.fonts.ready);
    const h = await page.evaluate(() => Math.max(900, Math.ceil(document.documentElement.scrollHeight)));
    await page.setViewport({ width: W, height: h, deviceScaleFactor: 1 });
    await new Promise(r => setTimeout(r, 300));
    const h2 = await page.evaluate(() => Math.max(900, Math.ceil(document.documentElement.scrollHeight)));
    if (h2 !== h) await page.setViewport({ width: W, height: h2, deviceScaleFactor: 1 });
    const szeles = await page.evaluate(() => document.documentElement.scrollWidth);
    const out = abs.replace(/\.html$/i, szelArg ? `_${W}.png` : '.png');
    await page.screenshot({ path: out });
    console.log(`${path.basename(out)}  ${W}x${h2}` + (szeles > W ? `  FIGYELEM: vízszintesen kilóg (${szeles}px)` : '') + (naplo.length ? '\n  ' + naplo.join('\n  ') : ''));
    if (naplo.length || szeles > W) hiba++;
    await page.close();
  }
  await browser.close();
  process.exit(hiba ? 1 : 0);
})();
