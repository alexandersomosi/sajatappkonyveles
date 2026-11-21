// 4b (11-21) változat: mint a tulaj_kep.cjs, de minden szelet előtt odagörget (különben a nézeten kívüli rétegek, pl. a bemutató
// értesítésének szövege, néha üresen vagy más lépés képernyőjével kerültek a képre), a nézetből fotóz, a ragadós bemutató az első lépésen marad
// (a görgetés/átméretezés nem váltja), a ragadós elemek (fejléc, szakaszcímek) a helyükön állnak.
// Éles (2x), szeletelt teljes oldalas képek a tulajnak: node _eszkoz/tulaj_kep.cjs <html> <kimeneti előtag> <szélesség> <dpr> <szelet css px> [képernyő-magasság]
// Mint a scratchpad hq_kep.cjs, de a „Mit kapsz” ragadós bemutatója egy képernyőnyire csukva látszik (teljes_kep_stilus.cjs),
// különben a görgetési hossz üres sötét sávként jelenne meg. Csökkentett mozgással fotóz: a rétegek a végállapotukban, a hős az első képen.
// Pl.: node _eszkoz/tulaj_kep.cjs index.html _kepek_tulajnak/kor2/gep 1440 2 1800 900
//      node _eszkoz/tulaj_kep.cjs index.html _kepek_tulajnak/kor2/telefon 390 2 1600 844
const path = require('path'), fs = require('fs');
const { pathToFileURL } = require('url');
const puppeteer = require(path.resolve(__dirname, '../../../kod/panel/node_modules/puppeteer-core'));
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(f => fs.existsSync(f));
const teljesKepStilus = require('./teljes_kep_stilus.cjs');
const [, , html, ki, szel, dpr, szelet, vhArg] = process.argv;
const VH = +(vhArg || 900);
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars', '--allow-file-access-from-files'] });
  const p = await b.newPage(); const hibak = [];
  p.on('console', m => { if (m.type() === 'error') hibak.push(m.text()); }); p.on('pageerror', e => hibak.push(String(e)));
  await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p.setViewport({ width: +szel, height: VH, deviceScaleFactor: +dpr });
  await p.goto(pathToFileURL(path.resolve(html)).href, { waitUntil: 'networkidle0', timeout: 60000 });
  await p.addStyleTag({ content: teljesKepStilus(VH) });
  // a mozgas.js görgetés- és átméretezés-figyelője ne váltson lépést a fotózás alatt (a captureBeyondViewport átméretezést is kivált)
  await p.evaluate(() => { const all = e => e.stopImmediatePropagation(); window.addEventListener('scroll', all, true); window.addEventListener('resize', all, true); });
  await p.waitForFunction(() => { const b = document.querySelector('.bemutato .blepes'); return !b || !matchMedia('(max-width: 980px)').matches || b.offsetHeight === 0; }, { timeout: 8000, polling: 100 })
    .catch(() => hibak.push('a teljes oldalas kép stílusa nem érvényesült'));
  await p.evaluate(async () => { await document.fonts.ready; for (const i of document.images) { i.loading = 'eager'; if (!i.complete) await new Promise(r => { i.onload = i.onerror = r; }); } });
  const h = await p.evaluate(() => document.documentElement.scrollHeight);
  // 4b: nincs előzetes végiggörgetés (a képek fent már betöltődtek): így a bemutató sosem vált lépést, és nem marad régi állapot a képen
  await p.evaluate(() => window.scrollTo(0, 0)); await new Promise(r => setTimeout(r, 800));
  const H = await p.evaluate(() => document.documentElement.scrollHeight);
  // a görgetés miatt a ragadós (sticky) elemek (fejléc, szakaszcímek) több szeletre is rákerülnének: a képhez a helyükön állnak
  const ragados = await p.evaluate(() => { let db = 0; for (const e of document.querySelectorAll('body *')) if (getComputedStyle(e).position === 'sticky') { e.style.setProperty('position', 'relative', 'important'); e.style.setProperty('top', 'auto', 'important'); db++; } return db; });
  const allapot = await p.evaluate(() => { window.__all = [...document.querySelectorAll('.bemutato, .bemutato *')].map(e => [e, e.getAttribute('class'), e.style.transform]); return window.__all.length; });
  let n = 0;
  // a szeleteket a nézetből fotózza (a nézet magassága = a szelet), nem captureBeyondViewport-tal: az utóbbi a bemutató rejtett
  // képernyőit (opacity 0) is a képre tette. A vh-függő méreteket a teljesKepStilus(VH) rögzíti, a figyelők le vannak tiltva.
  for (let y = 0; y < H; y += +szelet) { n++; const m = Math.min(+szelet, H - y);
    await p.setViewport({ width: +szel, height: m, deviceScaleFactor: +dpr });
    await p.evaluate(y => window.scrollTo(0, y), y); await new Promise(r => setTimeout(r, 250));
    await p.evaluate(() => { for (const [e, c, t] of window.__all) { if (c === null) e.removeAttribute('class'); else e.setAttribute('class', c); e.style.transform = t; } });
    await new Promise(r => setTimeout(r, 450));
    const v = await p.evaluate(() => window.scrollY); if (Math.abs(v - y) > 1) hibak.push('görgetés ' + y + ' helyett ' + v);
    await p.screenshot({ path: `${ki}_${String(n).padStart(2, '0')}.png` }); }
  console.log(JSON.stringify({ H, n, allapot, ragados, hibak })); await b.close();
})();
