// Rövid videó az oldal mozgásáról, hogy a tulaj a telefonján lássa: node _eszkoz/video.cjs [telefon|gep|asztali] [kimenet.mp4]
// telefon: 390x844 @2x (780x1688), gep: 1440x900 @1x, kb. 30 s (hős + ragadós bemutató, a könyvelő-szakasz nélkül),
// asztali: 1440x900 @1x a telefonos forgatókönyvvel. H.264, yuv420p, 30 fps.
// 11-20 éjjel: „gep” nézet (mozgas_gep.mp4) a tulajnak; a régi változat: _regi/elotte_kor2_utolso_20261120_2320/_eszkoz/video.cjs.
// Forgatókönyv (kb. 37 s): a hős váltakozó képernyői, aztán lassú görgetés a „Mit kapsz” ragadós bemutatóján
// (lépésenként megállva, hogy a rétegek lejátszódjanak), végül a könyvelő-szakasz.
// Felvétel: az oldal idejét lelassítjuk (CSS-animációk: CDP Animation.setPlaybackRate; JS: performance.now/Date.now/
// setTimeout/requestAnimationFrame), és sima képernyőképeket gyűjtünk; a kockák hossza a lassított (oldal-)idő szerint számít,
// így a videó valós sebességű. Ablakot nem nyit (headless), nem veszi el a fókuszt.
// 11-20 késő este: átírva a ragadós bemutatóhoz (a régi változat: _regi/elotte_kor2_ragados_20261120_2215/_eszkoz/video.cjs).
const path = require('path'), fs = require('fs'), os = require('os');
const { pathToFileURL } = require('url');
const { execFileSync } = require('child_process');
const puppeteer = require(path.resolve(__dirname, '../../../kod/panel/node_modules/puppeteer-core'));
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(f => fs.existsSync(f));
const FFMPEG = 'D:/Programs/ffmpeg/bin/ffmpeg.exe';
const GYOKER = path.join(__dirname, '..');
const OLDAL = pathToFileURL(path.join(GYOKER, 'index.html')).href;
const NEZETEK = {
  telefon: { ki: path.join(GYOKER, '_kepek_tulajnak/kor2/mozgas_telefon.mp4'), w: 390, h: 844, dpr: 2, K: 0.2 },
  asztali: { ki: path.join(GYOKER, '_kepek_tulajnak/kor2/mozgas_asztali.mp4'), w: 1440, h: 900, dpr: 1, K: 0.25 },
  // gépen rövidebb: a hős két váltása, a bemutató lépésenként (a rétegek a következő görgetés közben fejeződnek be), elengedés
  gep: { ki: path.join(GYOKER, '_kepek_tulajnak/kor2/mozgas_gep.mp4'), w: 1440, h: 900, dpr: 1, K: 0.25, hos: 7800, lepesGorget: 800, lepesVar: 1900, vege: 'elenged' },
};
const melyik = process.argv[2] || 'telefon';
const n = { ...NEZETEK[melyik] };
if (process.argv[3]) n.ki = path.resolve(process.argv[3]);
const varjValos = ms => new Promise(r => setTimeout(r, ms));

// az oldal idejének lassítása (a mozgas.js előtt fut)
function lassit(K) {
  const valosNow = performance.now.bind(performance), p0 = valosNow();
  performance.now = () => p0 + (valosNow() - p0) * K;
  const valosDate = Date.now, d0 = valosDate();
  Date.now = () => d0 + (valosDate() - d0) * K;
  const st = window.setTimeout.bind(window), si = window.setInterval.bind(window);
  window.setTimeout = (f, ms, ...a) => st(f, (ms || 0) / K, ...a);
  window.setInterval = (f, ms, ...a) => si(f, (ms || 0) / K, ...a);
  // a rAF időbélyegét a CDP Animation.setPlaybackRate maga is lassítja, ezért a (lassított) performance.now() megy át,
  // különben a számlálók a videóban négyszer lassabbak lennének (11-20 éjjel javítva)
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(() => cb(performance.now()));
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars', '--allow-file-access-from-files'] });
  const mappa = fs.mkdtempSync(path.join(os.tmpdir(), 'adozz_video_'));
  const page = await browser.newPage();
  const hibak = [];
  page.on('pageerror', e => hibak.push(e.message));
  page.on('console', m => { if (m.type() === 'error') hibak.push('konzol: ' + m.text()); });
  const cdp = await page.target().createCDPSession();
  await page.evaluateOnNewDocument(lassit, n.K);
  await cdp.send('Animation.enable');
  await cdp.send('Animation.setPlaybackRate', { playbackRate: n.K });
  const varj = ms => varjValos(ms / n.K); // oldal-időben várunk
  await page.setViewport({ width: n.w, height: n.h, deviceScaleFactor: n.dpr });
  await page.goto(OLDAL, { waitUntil: 'networkidle0', timeout: 60000 });
  await page.evaluate(async () => {
    await document.fonts.ready;
    for (const img of document.images) img.loading = 'eager';
    await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
    // simított görgetés a saját ütemezőnkkel (a CSS scroll-behavior: smooth kikerülve)
    window.__gorget = (cel, ms) => new Promise(res => {
      const y0 = scrollY, d = Math.max(0, Math.min(cel, document.documentElement.scrollHeight - innerHeight)) - y0, t0 = performance.now();
      (function f() {
        const x = Math.min(1, (performance.now() - t0) / ms), e = x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
        scrollTo({ top: y0 + d * e, behavior: 'instant' });
        if (x < 1) requestAnimationFrame(f); else res();
      })();
    });
    // a ragadós bemutató i. lépésének görgetési helye (ugyanaz a számítás, mint a mozgas.js-ben)
    window.__lepes = (i) => {
      const l = [...document.querySelectorAll('.bemutato .blepes')], sp = document.querySelector('.szinpad');
      const y = el => el.getBoundingClientRect().top + scrollY;
      const nn = l.length;
      if (matchMedia('(min-width: 981px)').matches) return y(l[i]) + l[i].offsetHeight / 2 - innerHeight / 2;
      const fent = parseFloat(getComputedStyle(sp).top) || 0;
      const hossz = y(l[nn - 1]) + l[nn - 1].offsetHeight - y(l[0]) - sp.offsetHeight;
      return y(l[0]) - fent + hossz * (i + 0.5) / nn;
    };
  });
  await page.evaluate(() => scrollTo(0, 0));
  await varjValos(600);

  // képkockák gyűjtése; t = oldal-idő másodpercben
  const kockak = [];
  let sorszam = 0, felvesz = true;
  const gyujto = (async () => {
    while (felvesz) {
      const a = Date.now();
      const buf = await page.screenshot({ type: 'jpeg', quality: 90 });
      const b = Date.now();
      const f = path.join(mappa, `k${String(sorszam++).padStart(5, '0')}.jpg`); fs.writeFileSync(f, buf);
      kockak.push({ f, t: ((a + b) / 2) / 1000 * n.K });
    }
  })();
  const kezdValos = Date.now();

  // 1) hős: váltakozó képernyők
  await varj(1000);
  if (n.w < 760) await page.evaluate(ms => { const r = document.querySelector('.hos-kep').getBoundingClientRect(); return window.__gorget(scrollY + r.top + r.height / 2 - innerHeight / 2 + 20, ms); }, 1100);
  await varj(n.hos || 6000);
  // 2) a ragadós bemutató: a szakasz eleje, aztán lépésenként
  await page.evaluate(ms => { const r = document.querySelector('#mit-kapsz').getBoundingClientRect(); return window.__gorget(scrollY + r.top - 40, ms); }, 1500);
  await varj(900);
  const db = await page.evaluate(() => document.querySelectorAll('.bemutato .blepes').length);
  for (let i = 0; i < db; i++) {
    await page.evaluate((i, ms) => window.__gorget(window.__lepes(i), ms), i, i === 0 ? 1200 : (n.lepesGorget || 900));
    await varj(n.lepesVar || 2200);
  }
  if (n.vege === 'elenged') {
    // 3) a bemutató vége: a telefon elenged, látszik a záró mondat és a következő szakasz eleje
    await page.evaluate(ms => { const r = document.querySelector('.bemutato-jegy').getBoundingClientRect(); return window.__gorget(scrollY + r.top - innerHeight * 0.55, ms); }, 1300);
    await varj(1400);
  } else {
    // 3) a könyvelő-szakasz: a fej, aztán a negyedéves lista
    await page.evaluate(ms => { const r = document.querySelector('#konyvelo').getBoundingClientRect(); return window.__gorget(scrollY + r.top - 70, ms); }, 1400);
    await varj(1600);
    await page.evaluate(ms => { const r = document.querySelector('.feladat-cim').getBoundingClientRect(); return window.__gorget(scrollY + r.top - 90, ms); }, 1300);
    await varj(2200);
  }

  const hosszValos = (Date.now() - kezdValos) / 1000;
  felvesz = false;
  await gyujto;
  await page.close();

  // összerakás: minden kocka addig áll, amíg a következő meg nem jön; az egész a felvétel hosszáig tart
  kockak.sort((a, b) => a.t - b.t);
  const t0 = kockak[0].t, osszHossz = hosszValos * n.K;
  let lista = '';
  kockak.forEach((k, j) => {
    const kov = j + 1 < kockak.length ? kockak[j + 1].t : Math.max(k.t + 0.2, t0 + osszHossz);
    lista += `file '${k.f.replace(/\\/g, '/')}'\nduration ${Math.max(0.001, kov - k.t).toFixed(4)}\n`;
  });
  lista += `file '${kockak[kockak.length - 1].f.replace(/\\/g, '/')}'\n`;
  const listaF = path.join(mappa, 'lista.txt');
  fs.writeFileSync(listaF, lista);
  fs.mkdirSync(path.dirname(n.ki), { recursive: true });
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listaF,
    '-vf', 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2:in_range=pc:out_range=tv,format=yuv420p',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p', '-color_range', 'tv',
    '-movflags', '+faststart', n.ki], { stdio: 'inherit' });
  console.log(`${path.basename(n.ki)}: ${kockak.length} kocka, ${osszHossz.toFixed(1)} s oldal-idő (${hosszValos.toFixed(0)} s felvétel)` + (hibak.length ? ' HIBA: ' + hibak.join(' | ') : ''));
  fs.rmSync(mappa, { recursive: true, force: true });
  await browser.close();
  process.exit(hibak.length ? 1 : 0);
})();
