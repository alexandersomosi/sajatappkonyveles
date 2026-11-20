// Képernyőképek az értékesítő oldalról: node _eszkoz/kep.cjs
// -> landing_asztali.png (1440 széles, 1x, teljes magasság) és landing_mobil.png (390 széles, 2x, teljes magasság)
// Előtte felépíti az index.html-t (epit.cjs). Hibát jelez, ha egy fájl nem töltődik be, vagy az oldal vízszintesen kilóg.
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
require('./epit.cjs');
const puppeteer = require(path.resolve(__dirname, '../../../kod/panel/node_modules/puppeteer-core'));
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(f => fs.existsSync(f));
const GYOKER = path.join(__dirname, '..');
const NEZETEK = [
  { nev: 'landing_asztali.png', w: 1440, h: 900, dpr: 1 },
  { nev: 'landing_mobil.png', w: 390, h: 844, dpr: 2 },
];
const csak = process.argv[2];
(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars', '--allow-file-access-from-files'] });
  let hiba = 0;
  for (const n of NEZETEK) {
    if (csak && !n.nev.includes(csak)) continue;
    const page = await browser.newPage();
    const naplo = [];
    page.on('console', m => { if (m.type() === 'error') naplo.push(m.text()); });
    page.on('requestfailed', r => naplo.push('BETÖLTÉSI HIBA: ' + r.url()));
    // Az oldal semmit nem kérhet idegen szervertől (CSP default-src 'self', „nem használ sütit”).
    page.on('request', r => { if (!/^(file|data):/.test(r.url())) naplo.push('IDEGEN KÉRÉS: ' + r.url()); });
    await page.setViewport({ width: n.w, height: n.h, deviceScaleFactor: n.dpr });
    await page.goto(pathToFileURL(path.join(GYOKER, 'index.html')).href, { waitUntil: 'networkidle0', timeout: 45000 }).catch(e => naplo.push('goto: ' + e.message));
    await page.evaluate(() => document.fonts && document.fonts.ready);
    const h = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
    await page.setViewport({ width: n.w, height: h, deviceScaleFactor: n.dpr });
    await page.evaluate(async () => {
      for (const img of document.images) { img.loading = 'eager'; if (!img.complete) await new Promise(r => { img.onload = img.onerror = r; }); }
    });
    await new Promise(r => setTimeout(r, 400));
    const adat = await page.evaluate(() => ({
      szeles: document.documentElement.scrollWidth,
      h: Math.ceil(document.documentElement.scrollHeight),
      geist: document.fonts.check('400 16px Geist'),
      rosszKep: [...document.images].filter(i => !i.naturalWidth).map(i => i.src),
      suti: document.cookie,
      script: document.scripts.length,
    }));
    // A Chrome egy képben kb. 16 384 eszközpixelnél magasabbat nem rögzít jól (ismétlődik), ezért szeletenként fotózunk és összefűzünk.
    await page.setViewport({ width: n.w, height: n.h, deviceScaleFactor: n.dpr });
    await page.evaluate(() => window.scrollTo(0, 0));
    const SZ = Math.floor(7000 / n.dpr);
    const darabok = [];
    for (let y = 0; y < adat.h; y += SZ) {
      const f = path.join(require('os').tmpdir(), `landing_${n.dpr}_${y}.png`);
      await page.screenshot({ path: f, clip: { x: 0, y, width: n.w, height: Math.min(SZ, adat.h - y) }, captureBeyondViewport: true });
      darabok.push(f);
    }
    require('child_process').execFileSync('python', [path.join(__dirname, 'osszefuz.py'), path.join(GYOKER, n.nev), ...darabok], { stdio: 'inherit' });
    darabok.forEach(f => fs.unlinkSync(f));
    const gond = [...naplo];
    if (adat.szeles > n.w) gond.push(`vízszintesen kilóg: ${adat.szeles}px`);
    if (!adat.geist) gond.push('a Geist nem töltődött be');
    if (adat.suti) gond.push('süti: ' + adat.suti);
    if (adat.script) gond.push('script az oldalon: ' + adat.script);
    if (adat.rosszKep.length) gond.push('hiányzó kép: ' + adat.rosszKep.join(', '));
    console.log(`${n.nev}  ${n.w}x${adat.h} @${n.dpr}x` + (gond.length ? '\n  ' + gond.join('\n  ') : '  OK'));
    if (gond.length) hiba++;
    await page.close();
  }
  await browser.close();
  process.exit(hiba ? 1 : 0);
})();
