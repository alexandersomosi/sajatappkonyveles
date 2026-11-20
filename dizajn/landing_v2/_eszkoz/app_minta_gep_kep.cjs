// A gépes app-minták (app_minta_gep/*.html, app_minta_gep.py) képei a hős böngészőablakához és a bemutató zárólépéséhez.
// 1280x800-as nézet (egy átlagos laptop), 1,25x -> 1600x1000 px PNG az app_minta_gep mappába; a webp-t a kepek_vag.py --gep készíti.
// Futtatás: python _eszkoz/app_minta_gep.py && node _eszkoz/app_minta_gep_kep.cjs && python _eszkoz/kepek_vag.py --gep
const path = require('path'), fs = require('fs');
const { pathToFileURL } = require('url');
const puppeteer = require(path.resolve(__dirname, '../../../kod/panel/node_modules/puppeteer-core'));
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(f => fs.existsSync(f));
const MAPPA = path.join(__dirname, 'app_minta_gep');
const W = 1280, H = 800, DPR = 1.25;
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars', '--allow-file-access-from-files'] });
  let hiba = 0;
  for (const f of fs.readdirSync(MAPPA).filter(f => f.endsWith('.html')).sort()) {
    const page = await browser.newPage();
    const naplo = [];
    page.on('console', m => { if (m.type() === 'error') naplo.push(m.text()); });
    page.on('requestfailed', r => naplo.push('BETÖLTÉSI HIBA: ' + r.url()));
    // (a C5_v2 minta a logó Poppins-betűjét a Google Fontsról tölti – ez csak a képkészítéskor fut, az értékesítő oldal nem kér idegen szervertől)
    await page.setViewport({ width: W, height: H, deviceScaleFactor: DPR });
    await page.goto(pathToFileURL(path.join(MAPPA, f)).href, { waitUntil: 'networkidle0', timeout: 30000 }).catch(e => naplo.push('goto: ' + e.message));
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await new Promise(r => setTimeout(r, 300));
    const szeles = await page.evaluate(() => document.documentElement.scrollWidth);
    const out = path.join(MAPPA, f.replace(/\.html$/, '.png'));
    await page.screenshot({ path: out, clip: { x: 0, y: 0, width: W, height: H } });
    console.log(`${path.basename(out)}  ${W}x${H} @${DPR}x` + (szeles > W ? `  FIGYELEM: kilóg (${szeles}px)` : '') + (naplo.length ? '\n  ' + naplo.join('\n  ') : ''));
    if (naplo.length || szeles > W) hiba++;
    await page.close();
  }
  await browser.close();
  process.exit(hiba ? 1 : 0);
})();
