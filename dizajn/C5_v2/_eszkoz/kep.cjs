// Képernyőkép a v2 mintákról: node _eszkoz/kep.cjs fajl1.html [fajl2.html ...]
// 390 px széles, 2x, teljes magasság (a fix alsó sáv a kép aljára kerül). A PNG a HTML mellé kerül, azonos névvel.
const path = require('path');
const { pathToFileURL } = require('url');
const fs = require('fs');
const puppeteer = require(path.resolve(__dirname, '../../../kod/panel/node_modules/puppeteer-core'));
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(f => fs.existsSync(f));
(async () => {
  const files = process.argv.slice(2);
  if (!files.length) { console.error('Használat: node kep.cjs oldal.html ...'); process.exit(2); }
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars', '--allow-file-access-from-files'] });
  let hiba = 0;
  for (const f of files) {
    const abs = path.resolve(f);
    const page = await browser.newPage();
    const naplo = [];
    page.on('console', m => { if (m.type() === 'error') naplo.push(m.text()); });
    page.on('requestfailed', r => naplo.push('BETÖLTÉSI HIBA: ' + r.url()));
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await page.goto(pathToFileURL(abs).href, { waitUntil: 'networkidle0', timeout: 30000 }).catch(e => naplo.push('goto: ' + e.message));
    await page.evaluate(() => document.fonts && document.fonts.ready);
    const h = await page.evaluate(() => Math.max(844, Math.ceil(document.documentElement.scrollHeight)));
    await page.setViewport({ width: 390, height: h, deviceScaleFactor: 2 });
    await new Promise(r => setTimeout(r, 300));
    const szeles = await page.evaluate(() => document.documentElement.scrollWidth);
    const out = abs.replace(/\.html$/i, '.png');
    await page.screenshot({ path: out });
    console.log(`${path.basename(out)}  390x${h}` + (szeles > 390 ? `  FIGYELEM: vízszintesen kilóg (${szeles}px)` : '') + (naplo.length ? '\n  ' + naplo.join('\n  ') : ''));
    if (naplo.length || szeles > 390) hiba++;
    await page.close();
  }
  await browser.close();
  process.exit(hiba ? 1 : 0);
})();
