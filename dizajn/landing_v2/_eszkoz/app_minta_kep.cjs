// Az app_minta/*.html képernyőképei (390 px széles, 2x, teljes magasság), mint a C5_v2/_eszkoz/kep.cjs.
// Mellé: app_minta/hatarok.json = a rétegek igazításához fontos elemek helye CSS px-ben (390 széles nézetben, a lap tetejétől).
// Futtatás: node _eszkoz/app_minta_kep.cjs   (utána: python _eszkoz/kepek_vag.py)
const path = require('path'), fs = require('fs');
const { pathToFileURL } = require('url');
const puppeteer = require(path.resolve(__dirname, '../../../kod/panel/node_modules/puppeteer-core'));
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(f => fs.existsSync(f));
const MAPPA = path.join(__dirname, 'app_minta');
const VALASZTOK = ['.allapot', '.fej', '.fej .sor1', '.fej .vissza-sor', '.fej h1', '.fej p', '.fej .ki', '.kamera .felso', '.kamera .keret', '.kamera .tipp-sor',
  '.doboz', 'main .k', '.lsor', '.hsor', '.nap', '.felado', '.buborek', '.megj', '.szegmens', '.nav', '.dokk', '.uzenet-sav', '.gomb', '.gomb-masod', '.szakasz-cim'];
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars', '--allow-file-access-from-files'] });
  const hatarok = {};
  let hiba = 0;
  for (const f of fs.readdirSync(MAPPA).filter(f => f.endsWith('.html')).sort()) {
    const page = await browser.newPage();
    const naplo = [];
    page.on('console', m => { if (m.type() === 'error') naplo.push(m.text()); });
    page.on('requestfailed', r => naplo.push('BETÖLTÉSI HIBA: ' + r.url()));
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await page.goto(pathToFileURL(path.join(MAPPA, f)).href, { waitUntil: 'networkidle0', timeout: 30000 }).catch(e => naplo.push('goto: ' + e.message));
    await page.evaluate(() => document.fonts && document.fonts.ready);
    const h = await page.evaluate(() => Math.max(844, Math.ceil(document.documentElement.scrollHeight)));
    await page.setViewport({ width: 390, height: h, deviceScaleFactor: 2 });
    await new Promise(r => setTimeout(r, 300));
    const out = path.join(MAPPA, f.replace(/\.html$/, '.png'));
    await page.screenshot({ path: out });
    hatarok[f.replace(/\.html$/, '')] = await page.evaluate((v) => {
      const o = { magassag: document.documentElement.scrollHeight };
      for (const s of v) {
        const els = [...document.querySelectorAll(s)];
        if (els.length) o[s] = els.map(e => { const r = e.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top + scrollY), Math.round(r.width), Math.round(r.height), (e.textContent || '').trim().slice(0, 40)]; });
      }
      return o;
    }, VALASZTOK);
    console.log(`${path.basename(out)}  390x${h}` + (naplo.length ? '\n  ' + naplo.join('\n  ') : ''));
    if (naplo.length) hiba++;
    await page.close();
  }
  fs.writeFileSync(path.join(MAPPA, 'hatarok.json'), JSON.stringify(hatarok, null, 1));
  await browser.close();
  process.exit(hiba ? 1 : 0);
})();
