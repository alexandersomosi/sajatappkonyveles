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
  await p.evaluate(async () => { await document.fonts.ready; for (const i of document.images) { i.loading = 'eager'; if (!i.complete) await new Promise(r => { i.onload = i.onerror = r; }); } });
  const h = await p.evaluate(() => document.documentElement.scrollHeight);
  for (let y = 0; y < h; y += 600) { await p.evaluate(y => window.scrollTo(0, y), y); await new Promise(r => setTimeout(r, 60)); }
  await p.evaluate(() => window.scrollTo(0, 0)); await new Promise(r => setTimeout(r, 800));
  const H = await p.evaluate(() => document.documentElement.scrollHeight);
  let n = 0;
  for (let y = 0; y < H; y += +szelet) { n++; await p.screenshot({ path: `${ki}_${String(n).padStart(2, '0')}.png`, clip: { x: 0, y, width: +szel, height: Math.min(+szelet, H - y) }, captureBeyondViewport: true }); }
  console.log(JSON.stringify({ H, n, hibak })); await b.close();
})();
