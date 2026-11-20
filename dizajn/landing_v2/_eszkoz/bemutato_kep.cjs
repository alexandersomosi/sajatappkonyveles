// A „Mit kapsz” ragadós bemutató ellenőrző képei: node _eszkoz/bemutato_kep.cjs <kimeneti előtag> <szélesség> <magasság> <dpr> [csendes]
// Mozgással (vagy „csendes” = prefers-reduced-motion) végiggörget a szakaszon, és képernyőképet készít:
//   _00 = a szakasz eleje (a színpad épp beér), _01…_08 = lépésenként (a rétegek végállapotában, 2,8 s várakozás után;
//   3. kör: _08 = a „Gépen is ugyanez” zárólépés), _01a…_08a = ugyanott 0,6 s-nál (mozgás közben), _vege = a szakasz vége (a színpad elenged).
// Közben méri: aktív lépés, a telefon és a szöveg helye (a szöveg a képernyőn belül és a telefon alatt/mellett van-e),
// vízszintes kilógás, JS-hiba. Kimenet: JSON a konzolra; hiba esetén kilépési kód 1.
const path = require('path'), fs = require('fs');
const { pathToFileURL } = require('url');
const puppeteer = require(path.resolve(__dirname, '../../../kod/panel/node_modules/puppeteer-core'));
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(f => fs.existsSync(f));
const [, , ki, W, H, DPR, mod, oldalArg] = process.argv;
const OLDAL = oldalArg ? pathToFileURL(path.resolve(oldalArg)).href : pathToFileURL(path.join(__dirname, '..', 'index.html')).href;
const varj = ms => new Promise(r => setTimeout(r, ms));
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars', '--allow-file-access-from-files'] });
  const p = await b.newPage();
  const hibak = [];
  p.on('console', m => { if (m.type() === 'error') hibak.push('konzol: ' + m.text()); });
  p.on('pageerror', e => hibak.push('JS-hiba: ' + e.message));
  p.on('requestfailed', r => hibak.push('betöltés: ' + r.url().slice(0, 90)));
  if (mod === 'csendes') await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p.setViewport({ width: +W, height: +H, deviceScaleFactor: +DPR });
  await p.goto(OLDAL, { waitUntil: 'networkidle0', timeout: 60000 });
  await p.evaluate(async () => { await document.fonts.ready; for (const i of document.images) i.loading = 'eager'; });
  await varj(500);
  const geo = await p.evaluate(() => {
    const b = document.querySelector('.bemutato'), l = [...document.querySelectorAll('.bemutato .blepes')];
    const sp = document.querySelector('.szinpad');
    const y = el => el.getBoundingClientRect().top + scrollY;
    return {
      mod: b.classList.contains('szinpad-mod'), szeles: matchMedia('(min-width: 981px)').matches,
      bTop: y(b), bH: b.offsetHeight, lTops: l.map(y), lH: l.map(e => e.offsetHeight),
      spH: sp ? sp.offsetHeight : 0, fent: sp ? parseFloat(getComputedStyle(sp).top) || 0 : 0,
      szakasz: document.querySelector('#mit-kapsz').offsetHeight, oldal: document.documentElement.scrollHeight,
    };
  });
  const n = geo.lTops.length;
  const celok = [];
  celok.push({ nev: '00', y: geo.bTop - +H * 0.55, var: 900 });
  for (let i = 0; i < n; i++) {
    let y;
    if (geo.szeles) y = geo.lTops[i] + geo.lH[i] / 2 - +H / 2;
    else { const hossz = geo.lTops[n - 1] + geo.lH[n - 1] - geo.lTops[0] - geo.spH; y = geo.lTops[0] - geo.fent + hossz * (i + 0.5) / n; }
    celok.push({ nev: String(i + 1).padStart(2, '0') + 'a', y, var: 600, kozben: true });
    celok.push({ nev: String(i + 1).padStart(2, '0'), y, var: 2800 });
  }
  celok.push({ nev: 'vege', y: geo.bTop + geo.bH - +H * 0.7, var: 800 });
  const meres = [];
  let rossz = 0;
  for (const c of celok) {
    if (!c.kozben) { /* a végállapot: ugyanott várunk tovább */ }
    else {
      // máshonnan érkezünk, hogy a képernyő újrainduljon: előbb a szakasz fölé, aztán a célra
    }
    await p.evaluate(y => window.scrollTo({ top: y, behavior: 'instant' }), Math.max(0, Math.round(c.y)));
    await varj(c.var);
    await p.screenshot({ path: `${ki}_${c.nev}.png` });
    const m = await p.evaluate(() => {
      const vh = innerHeight, vw = innerWidth;
      const r = el => { if (!el) return null; const q = el.getBoundingClientRect(); return [Math.round(q.left), Math.round(q.top), Math.round(q.right), Math.round(q.bottom)]; };
      const akt = [...document.querySelectorAll('.bemutato .blepes')].findIndex(e => e.classList.contains('aktiv'));
      const tel = document.querySelector('.szinpad .telefon');
      const sz = document.querySelector('.szinpad-szovegek .aktiv');
      const szLathato = sz && getComputedStyle(document.querySelector('.szinpad-szovegek')).display !== 'none';
      const fej = document.querySelector('.fejlec').getBoundingClientRect().bottom;
      return {
        akt, tel: r(tel), szoveg: szLathato ? r(sz) : null, fej: Math.round(fej), vh, vw,
        kilog: document.documentElement.scrollWidth > vw,
        fut: !!document.querySelector('.szinpad-tarto .kepernyo.aktiv.fut'),
        gepMod: !!document.querySelector('.szinpad.gep-mod'),
        bongeszo: (() => { const g = document.querySelector('.szinpad-bongeszo'); if (!g) return null; const q = g.getBoundingClientRect(); return [Math.round(q.left), Math.round(q.top), Math.round(q.right), Math.round(q.bottom), getComputedStyle(g).opacity]; })(),
        toltes: [...document.querySelectorAll('.halado i')].map(i => i.style.transform.replace(/scaleX\(|\)/g, '')).join(' '),
        szovegCim: sz ? sz.querySelector('h3').textContent : null,
      };
    });
    const gond = [];
    if (m.kilog) gond.push('vízszintes kilógás');
    if (m.szoveg && /^(?!00)\d\d/.test(c.nev)) {
      if (m.szoveg[3] > m.vh + 1) gond.push('a szöveg kilóg alul');
      if (m.tel && m.szoveg[1] < m.tel[3] - 1) gond.push('a szöveg a telefon alá csúszik');
    }
    if (m.tel && /^(?!00)\d\d$/.test(c.nev) && (m.tel[1] < m.fej - 1)) gond.push('a telefon a fejléc alá csúszik');
    if (m.bongeszo && m.gepMod && /^(?!00)\d\d$/.test(c.nev)) {
      if (m.bongeszo[1] < m.fej - 1) gond.push('a böngészőablak a fejléc alá csúszik');
      if (m.szoveg && m.szoveg[1] < m.bongeszo[3] - 1 && m.szoveg[0] < m.bongeszo[2]) gond.push('a szöveg a böngészőablak alá csúszik');
      if (m.bongeszo[0] < -1 || m.bongeszo[2] > m.vw + 1) gond.push('a böngészőablak kilóg oldalt');
    }
    if (gond.length) rossz++;
    meres.push({ kep: c.nev, ...m, gond });
  }
  console.log(JSON.stringify({ geo: { ...geo, lTops: undefined, lH: geo.lH[0] }, meres, hibak }, null, 0).replace(/},{/g, '},\n{'));
  await b.close();
  process.exit(rossz || hibak.length ? 1 : 0);
})();
