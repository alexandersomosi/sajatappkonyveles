// Rövid videó az oldal mozgásáról, hogy a tulaj a telefonján lássa: node _eszkoz/video.cjs [mobil|asztali]
// -> mozgas_mobil.mp4 (390x844 @2x = 780x1688) és mozgas_asztali.mp4 (1440x900), H.264, yuv420p, 30 fps.
// Forgatókönyv: a hős váltakozó képernyői, aztán lépésenként végig a mozgó bemutatón (#mit-kapsz), végül a könyvelő-szakasz.
// Két felvételi mód:
//  - 'kozvetites' (asztali): a Chrome képernyő-közvetítése (CDP Page.startScreencast), valós időben, az időbélyegek szerint.
//  - 'lassitott' (mobil @2x): a fej nélküli Chrome közvetítése csak 1x-es képet ad, ezért itt az oldal idejét lelassítjuk
//    (CSS-animációk: CDP Animation.setPlaybackRate; JS: performance.now/Date.now/setTimeout/requestAnimationFrame),
//    és sima képernyőképeket gyűjtünk; a kockák hossza a lassított (oldal-)idő szerint számít, így a videó valós sebességű.
// Ablakot nem nyit (headless), nem veszi el a fókuszt.
const path = require('path'), fs = require('fs'), os = require('os');
const { pathToFileURL } = require('url');
const { execFileSync } = require('child_process');
const puppeteer = require(path.resolve(__dirname, '../../../kod/panel/node_modules/puppeteer-core'));
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(f => fs.existsSync(f));
const FFMPEG = 'D:/Programs/ffmpeg/bin/ffmpeg.exe';
const GYOKER = path.join(__dirname, '..');
const OLDAL = pathToFileURL(path.join(GYOKER, 'index.html')).href;
const NEZETEK = [
  { nev: 'mozgas_mobil.mp4', w: 390, h: 844, dpr: 2, mod: 'lassitott', K: 0.2, hosVar: 5600, lepesVar: 2400, gorget: 1100 },
  { nev: 'mozgas_asztali.mp4', w: 1440, h: 900, dpr: 1, mod: 'kozvetites', K: 1, hosVar: 7000, lepesVar: 2600, gorget: 1200 },
];
const csak = process.argv[2];
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
  const raf = window.requestAnimationFrame.bind(window);
  window.requestAnimationFrame = cb => raf(t => cb(p0 + (t - p0) * K));
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars', '--allow-file-access-from-files'] });
  for (const n of NEZETEK) {
    if (csak && !n.nev.includes(csak)) continue;
    const mappa = fs.mkdtempSync(path.join(os.tmpdir(), 'adozz_video_'));
    const page = await browser.newPage();
    const hibak = [];
    page.on('pageerror', e => hibak.push(e.message));
    const cdp = await page.target().createCDPSession();
    if (n.K !== 1) {
      await page.evaluateOnNewDocument(lassit, n.K);
      await cdp.send('Animation.enable');
      await cdp.send('Animation.setPlaybackRate', { playbackRate: n.K });
    }
    const varj = ms => varjValos(ms / n.K); // oldal-időben várunk
    await page.setViewport({ width: n.w, height: n.h, deviceScaleFactor: n.dpr });
    await page.goto(OLDAL, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.evaluate(async () => {
      await document.fonts.ready;
      for (const img of document.images) { if (img.loading === 'lazy' && img.offsetParent) img.loading = 'eager'; }
      // simított görgetés a saját ütemezőnkkel (a CSS scroll-behavior: smooth kikerülve)
      window.__gorget = (cel, ms) => new Promise(res => {
        const y0 = scrollY, d = Math.max(0, Math.min(cel, document.documentElement.scrollHeight - innerHeight)) - y0, t0 = performance.now();
        (function f() {
          const x = Math.min(1, (performance.now() - t0) / ms), e = x < .5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
          scrollTo({ top: y0 + d * e, behavior: 'instant' });
          if (x < 1) requestAnimationFrame(f); else res();
        })();
      });
      window.__kozepre = (el, eltol) => { const r = el.getBoundingClientRect(); return scrollY + r.top + r.height / 2 - innerHeight / 2 + (eltol || 0); };
    });
    await varjValos(800);

    // képkockák gyűjtése; t = oldal-idő másodpercben
    const kockak = [];
    let sorszam = 0, felvesz = true, gyujto = null;
    const ujFajl = () => path.join(mappa, `k${String(sorszam++).padStart(5, '0')}.jpg`);
    if (n.mod === 'kozvetites') {
      cdp.on('Page.screencastFrame', async ev => {
        const f = ujFajl();
        fs.writeFileSync(f, Buffer.from(ev.data, 'base64'));
        kockak.push({ f, t: ev.metadata.timestamp });
        try { await cdp.send('Page.screencastFrameAck', { sessionId: ev.sessionId }); } catch (e) { }
      });
      await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 90, maxWidth: n.w * n.dpr, maxHeight: n.h * n.dpr, everyNthFrame: 1 });
    } else {
      gyujto = (async () => {
        while (felvesz) {
          const a = Date.now();
          const buf = await page.screenshot({ type: 'jpeg', quality: 90 });
          const b = Date.now();
          const f = ujFajl(); fs.writeFileSync(f, buf);
          kockak.push({ f, t: ((a + b) / 2) / 1000 * n.K });
        }
      })();
    }
    const kezdValos = Date.now();

    // 1) hős: váltakozó képernyők
    await varj(1200);
    if (n.w < 760) await page.evaluate(ms => window.__gorget(window.__kozepre(document.querySelector('.hos-kep'), 30), ms), 1100);
    await varj(n.hosVar);
    // 2) a mozgó bemutató lépései
    const db = await page.evaluate(() => document.querySelectorAll('.blepes').length);
    for (let i = 0; i < db; i++) {
      await page.evaluate((i, ms) => {
        const l = document.querySelectorAll('.blepes')[i];
        const cel = document.querySelector('.szinpad-mod') ? l.querySelector('.blepes-szoveg') : l.querySelector('.blepes-kep');
        return window.__gorget(window.__kozepre(cel), ms);
      }, i, i === 0 ? 1500 : n.gorget);
      await varj(n.lepesVar);
    }
    // 3) a könyvelő-szakasz (mobilon előbb a szöveg, aztán az idővonal)
    await page.evaluate(ms => { const r = document.querySelector('#konyvelo').getBoundingClientRect(); return window.__gorget(scrollY + r.top - 64, ms); }, 1300);
    await varj(n.w < 760 ? 1400 : 2800);
    if (n.w < 760) {
      await page.evaluate(ms => window.__gorget(window.__kozepre(document.querySelector('.negyedev')), ms), 1300);
      await varj(2800);
    }
    const hosszValos = (Date.now() - kezdValos) / 1000;
    if (n.mod === 'kozvetites') await cdp.send('Page.stopScreencast');
    felvesz = false;
    if (gyujto) await gyujto;
    await varjValos(300);
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
    const ki = path.join(GYOKER, n.nev);
    execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listaF,
      '-vf', 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2:in_range=pc:out_range=tv,format=yuv420p',
      '-c:v', 'libx264', '-preset', 'slow', '-crf', '21', '-pix_fmt', 'yuv420p', '-color_range', 'tv',
      '-movflags', '+faststart', ki], { stdio: 'inherit' });
    console.log(`${n.nev}: ${kockak.length} kocka, ${osszHossz.toFixed(1)} s oldal-idő (${hosszValos.toFixed(0)} s felvétel)` + (hibak.length ? ' JS-hiba: ' + hibak.join(' | ') : ''));
    fs.rmSync(mappa, { recursive: true, force: true });
  }
  await browser.close();
})();
