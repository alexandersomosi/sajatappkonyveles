// Képernyőképek az értékesítő oldalról: node _eszkoz/kep.cjs [asztali|mobil]
// -> landing_asztali.png (1440 széles, 1x, teljes magasság) és landing_mobil.png (390 széles, 2x, teljes magasság)
// Előtte felépíti az index.html-t (epit.cjs). Hibát jelez, ha egy fájl nem töltődik be, idegen szerverhez fordulna,
// az oldal vízszintesen kilóg, vagy a CSP-t (default-src 'self') sértő elem van benne.
// 11-20 este: az oldalon egyetlen saját script lehet (mozgas.js). A teljes oldalas képhez csökkentett mozgást emulálunk
// (prefers-reduced-motion: reduce) -> nincs mozgás, minden réteg a végállapotában látszik.
// Ezen felül: mozgás-próba (1440 és 390, mozgással végiggörgetve: JS-hiba, kilógás), és kilógás-próba 1280 és 768 szélességen.
// 11-20 késő este: a „Mit kapsz” ragadós bemutató (gépen és telefonon is) a teljes oldalas képen egy képernyőnyire csukva látszik
// (teljes_kep_stilus.cjs, csak a képhez); a görgetés közbeni állapotokat a bemutato_kep.cjs fotózza.
const teljesKepStilus = require('./teljes_kep_stilus.cjs');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
require('./epit.cjs');
const puppeteer = require(path.resolve(__dirname, '../../../kod/panel/node_modules/puppeteer-core'));
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(f => fs.existsSync(f));
const GYOKER = path.join(__dirname, '..');
const OLDAL = pathToFileURL(path.join(GYOKER, 'index.html')).href;
const NEZETEK = [
  { nev: 'landing_asztali.png', w: 1440, h: 900, dpr: 1 },
  { nev: 'landing_mobil.png', w: 390, h: 844, dpr: 2 },
];
const ENGEDETT_SCRIPT = /\/mozgas\.js$/;
const csak = process.argv[2];

// A forrás ellenőrzése (CSP default-src 'self'): nincs inline script, inline stílus vagy inline eseménykezelő.
function forrasProba() {
  const h = fs.readFileSync(path.join(GYOKER, 'index.html'), 'utf8');
  const gond = [];
  for (const m of h.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    const src = (m[1].match(/\bsrc="([^"]+)"/) || [])[1];
    if (!src) gond.push('inline script');
    else if (!ENGEDETT_SCRIPT.test('/' + src)) gond.push('nem engedett script: ' + src);
    if (m[2].trim()) gond.push('script tartalommal');
  }
  if (/<style\b/i.test(h)) gond.push('inline <style>');
  if (/\sstyle="/i.test(h)) gond.push('inline style= attribútum');
  const on = h.match(/<[^>]+\son[a-z]+="/gi);
  if (on) gond.push('inline eseménykezelő: ' + on.slice(0, 3).join(' | '));
  if (/https?:\/\/(?!app\.adozz\.hu)[^"'\s)]+\.(js|css|woff2?|ttf|png|jpe?g|webp|svg)/i.test(h)) gond.push('idegen forrás a HTML-ben');
  return gond;
}

function figyel(page, naplo) {
  page.on('console', m => { if (m.type() === 'error') naplo.push('konzol: ' + m.text()); });
  page.on('pageerror', e => naplo.push('JS-hiba: ' + e.message));
  page.on('requestfailed', r => naplo.push('BETÖLTÉSI HIBA: ' + r.url()));
  // Az oldal semmit nem kérhet idegen szervertől (CSP default-src 'self', „nem használ sütit”).
  page.on('request', r => { if (!/^(file|data):/.test(r.url())) naplo.push('IDEGEN KÉRÉS: ' + r.url()); });
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars', '--allow-file-access-from-files'] });
  let hiba = 0;
  const fg = forrasProba();
  console.log('forrás (CSP)' + (fg.length ? '\n  ' + fg.join('\n  ') : '  OK'));
  if (fg.length) hiba++;

  for (const n of NEZETEK) {
    if (csak && !n.nev.includes(csak)) continue;
    const page = await browser.newPage();
    const naplo = [];
    figyel(page, naplo);
    await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await page.setViewport({ width: n.w, height: n.h, deviceScaleFactor: n.dpr });
    await page.goto(OLDAL, { waitUntil: 'networkidle0', timeout: 45000 }).catch(e => naplo.push('goto: ' + e.message));
    await page.evaluate(() => document.fonts && document.fonts.ready);
    await page.addStyleTag({ content: teljesKepStilus(n.h) });
    const h = await page.evaluate(() => Math.ceil(document.documentElement.scrollHeight));
    await page.setViewport({ width: n.w, height: h, deviceScaleFactor: n.dpr });
    await page.evaluate(async () => {
      for (const img of document.images) { img.loading = 'eager'; if (!img.complete) await new Promise(r => { img.onload = img.onerror = r; }); }
    });
    await new Promise(r => setTimeout(r, 400));
    const adat = await page.evaluate((minta) => ({
      szeles: document.documentElement.scrollWidth,
      h: Math.ceil(document.documentElement.scrollHeight),
      geist: document.fonts.check('400 16px Geist'),
      rosszKep: [...document.images].filter(i => !i.naturalWidth && getComputedStyle(i).display !== 'none' && i.offsetParent).map(i => i.src.slice(0, 80)),
      suti: document.cookie,
      scriptek: [...document.scripts].map(s => s.src || 'INLINE').filter(s => !new RegExp(minta).test(s)),
      js: document.documentElement.classList.contains('js'),
      mozog: document.documentElement.classList.contains('mozog'),
    }), ENGEDETT_SCRIPT.source);
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
    if (adat.scriptek.length) gond.push('nem engedett script: ' + adat.scriptek.join(', '));
    if (!adat.js) gond.push('a mozgas.js nem futott le');
    if (adat.mozog) gond.push('csökkentett mozgásnál is mozog');
    if (adat.rosszKep.length) gond.push('hiányzó kép: ' + adat.rosszKep.join(', '));
    console.log(`${n.nev}  ${n.w}x${adat.h} @${n.dpr}x (csökkentett mozgás, állókép)` + (gond.length ? '\n  ' + gond.join('\n  ') : '  OK'));
    if (gond.length) hiba++;
    await page.close();
  }

  // Mozgás-próba: mozgással végiggörgetve nincs JS-hiba és nincs vízszintes kilógás; kilógás-próba más szélességeken.
  const PROBAK = [
    { w: 1440, h: 900, gorget: true }, { w: 390, h: 844, gorget: true },
    { w: 1280, h: 800, gorget: true }, { w: 768, h: 1024, gorget: true },
  ];
  if (!csak) for (const p of PROBAK) {
    const page = await browser.newPage();
    const naplo = [];
    figyel(page, naplo);
    await page.setViewport({ width: p.w, height: p.h, deviceScaleFactor: 1 });
    await page.goto(OLDAL, { waitUntil: 'networkidle0', timeout: 45000 }).catch(e => naplo.push('goto: ' + e.message));
    const eredmeny = await page.evaluate(async (gorget) => {
      const varj = ms => new Promise(r => setTimeout(r, ms));
      let max = document.documentElement.scrollWidth;
      const H = document.documentElement.scrollHeight;
      if (gorget) for (let y = 0; y < H; y += Math.round(innerHeight * 0.6)) {
        scrollTo({ top: y, behavior: 'instant' }); await varj(160);
        max = Math.max(max, document.documentElement.scrollWidth);
      }
      return {
        max,
        mozog: document.documentElement.classList.contains('mozog'),
        szinpad: !!document.querySelector('.szinpad-mod'),
        aktivUtolso: [...document.querySelectorAll('.bemutato .blepes')].findIndex(e => e.classList.contains('aktiv')),
      };
    }, p.gorget);
    const gond = [...naplo];
    if (eredmeny.max > p.w) gond.push(`vízszintesen kilóg: ${eredmeny.max}px`);
    if (!eredmeny.mozog) gond.push('nem indult el a mozgás');
    if (!eredmeny.szinpad) gond.push('nincs ragadós bemutató');
    if (eredmeny.aktivUtolso !== 6) gond.push('végiggörgetés után nem az utolsó lépés aktív: ' + eredmeny.aktivUtolso);
    console.log(`mozgás-próba ${p.w}x${p.h} (ragadós bemutató)` + (gond.length ? '\n  ' + gond.join('\n  ') : '  OK'));
    if (gond.length) hiba++;
    await page.close();
  }
  await browser.close();
  process.exit(hiba ? 1 : 0);
})();
