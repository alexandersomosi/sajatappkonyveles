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
// 11-21 (3. kör javító): új forgatókönyv a kattintható hőshöz (a régi: _regi/elotte_kor3_javito_20261121_0034/_eszkoz/video.cjs).
//   betöltés -> a hős (telefonon odagörget), az egyszeri gyűrű a Dosszién -> koppintás/kattintás a telefon menüjének 4 pontjára
//   egymás után (Dosszié, Fotózás, Üzenetek, Főoldal; a böngészőablak is vált) -> lassú görgetés a ragadós bemutatón végig,
//   a „Gépen is ugyanez” zárólépésnél megállva. A koppintást/kattintást egy rárajzolt ujj-, ill. egérmutató jelzi
//   (csak a felvételen, az oldalnak nem része). Telefonon érintéses eszközt emulál (koppintás, nincs hover).
//   Kimenet: _kepek_tulajnak/kor3/mozgas_telefon.mp4 (390x844 @2) és mozgas_gep.mp4 (1440x900 @1), kb. 40 s.
const path = require('path'), fs = require('fs'), os = require('os');
const { pathToFileURL } = require('url');
const { execFileSync } = require('child_process');
const puppeteer = require(path.resolve(__dirname, '../../../kod/panel/node_modules/puppeteer-core'));
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(f => fs.existsSync(f));
const FFMPEG = 'D:/Programs/ffmpeg/bin/ffmpeg.exe';
const GYOKER = path.join(__dirname, '..');
const OLDAL = pathToFileURL(path.join(GYOKER, 'index.html')).href;
const NEZETEK = {
  telefon: { ki: path.join(GYOKER, '_kepek_tulajnak/kor3/mozgas_telefon.mp4'), w: 390, h: 844, dpr: 2, K: 0.2, erintes: true, lepesGorget: 800, lepesVar: 1700, utana: 1300, vegVar: 2600, gyuruVar: 3000 },
  asztali: { ki: path.join(GYOKER, '_kepek_tulajnak/kor3/mozgas_asztali.mp4'), w: 1440, h: 900, dpr: 1, K: 0.25 },
  // gépen: a bemutató lépésenként (a rétegek a következő görgetés közben fejeződnek be), a zárólépésnél megáll
  gep: { ki: path.join(GYOKER, '_kepek_tulajnak/kor3/mozgas_gep.mp4'), w: 1440, h: 900, dpr: 1, K: 0.25, lepesGorget: 850, lepesVar: 2000 },
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
  await page.emulate({ viewport: { width: n.w, height: n.h, deviceScaleFactor: n.dpr, isMobile: !!n.erintes, hasTouch: !!n.erintes },
    userAgent: n.erintes ? 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36' : await browser.userAgent() });
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
    // a felvételre rajzolt mutató: telefonon ujjnyom (kör), gépen egérnyíl; csak transform/opacity, pointer-events: none
    const m = document.createElement('div');
    m.setAttribute('aria-hidden', 'true');
    m.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483647;pointer-events:none;opacity:0;transition:opacity .25s,transform .9s cubic-bezier(.3,.7,.2,1);will-change:transform';
    window.__ujj = matchMedia('(pointer: coarse)').matches;
    m.innerHTML = window.__ujj
      ? '<div style="width:46px;height:46px;margin:-23px 0 0 -23px;border-radius:50%;background:rgba(16,21,43,.28);box-shadow:0 0 0 2px rgba(255,255,255,.9),0 4px 14px rgba(16,21,43,.35);transition:transform .18s"></div>'
      : '<svg width="26" height="30" viewBox="0 0 26 30" style="display:block;margin:-2px 0 0 -3px;filter:drop-shadow(0 2px 3px rgba(0,0,0,.35));transition:transform .15s"><path d="M3 2l19 16.5-8.6.8 5 9.2-3.6 1.9-5-9.3L3 27z" fill="#10152B" stroke="#fff" stroke-width="1.6" stroke-linejoin="round"/></svg>';
    document.body.appendChild(m);
    window.__mutato = m;
    window.__mozgat = (x, y, ms) => new Promise(res => {
      m.style.transitionDuration = '.25s,' + (ms / 1000) + 's';
      m.style.opacity = '1'; m.style.transform = `translate(${x}px,${y}px)`;
      setTimeout(res, ms + 30);
    });
    window.__nyom = (le) => { m.firstChild.style.transform = le ? 'scale(.82)' : 'none'; };
    window.__elrejt = () => { m.style.opacity = '0'; };
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

  // 1) betöltés, aztán a hős: telefonon odagörgetünk (ekkor fut le a Dosszién az egyszeri gyűrű)
  await varj(1100);
  if (n.w < 760) await page.evaluate(ms => { const r = document.querySelector('.kompo-hos').getBoundingClientRect(), fej = document.querySelector('.fejlec').offsetHeight; return window.__gorget(scrollY + r.top - fej - (innerHeight - fej - r.height) / 2, ms); }, 1100);
  // kivárjuk a gyűrűt (a telefon látszódásától 1,6 s + 1,4 s), aztán a mutató megjelenik a telefon mellett
  const gombok = await page.evaluate(() => [...document.querySelectorAll('.hos-menu button')].map(g => { const r = g.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height * 0.45]; }));
  const kezd = n.erintes ? [gombok[1][0] + 40, gombok[1][1] - 160] : [gombok[1][0] - 260, gombok[1][1] - 220];
  await page.evaluate(([x, y]) => { window.__mutato.style.transitionDuration = '0s'; window.__mutato.style.transform = `translate(${x}px,${y}px)`; }, kezd);
  await varj(n.gyuruVar || 2300);   // a gyűrű lefut, csak utána jelenik meg a mutató
  await page.evaluate(([x, y]) => window.__mozgat(x, y, 10), kezd);
  await varj(500);
  // 2) koppintás/kattintás a telefon menüjének 4 pontjára egymás után; a telefon ÉS a böngészőablak is vált
  for (const i of [1, 2, 3, 0]) {
    const [x, y] = gombok[i];
    await page.evaluate(([x, y], ms) => window.__mozgat(x, y, ms), [x, y], 700);   // (megvárja, amíg a mutató odaér)
    await page.evaluate(() => window.__nyom(true));
    if (n.erintes) await page.touchscreen.tap(x, y); else await page.mouse.click(x, y);
    // a felvétel közbeni képernyőképek (eszközméret-felülírás) olykor elnyelik az érintést: ha nem váltott, ugyanoda kattintunk JS-ből
    await varj(120);
    const valtott = await page.evaluate(i => document.querySelectorAll('.hos-menu button')[i].getAttribute('aria-pressed') === 'true', i);
    if (!valtott) { await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); if (e) e.click(); }, [x, y]); console.log('  (koppintás JS-ből pótolva: ' + i + ')'); }
    await varj(60);
    await page.evaluate(() => window.__nyom(false));
    await varj(n.utana || 1500);
  }
  await page.evaluate(() => window.__elrejt());
  await varj(500);
  // 3) a ragadós bemutató: a szakasz eleje, aztán lépésenként, végül a „Gépen is ugyanez” zárólépésnél megállunk
  await page.evaluate(ms => { const r = document.querySelector('#mit-kapsz').getBoundingClientRect(); return window.__gorget(scrollY + r.top - 40, ms); }, n.erintes ? 1200 : 1500);
  await varj(n.erintes ? 700 : 900);
  const db = await page.evaluate(() => document.querySelectorAll('.bemutato .blepes').length);
  for (let i = 0; i < db; i++) {
    await page.evaluate((i, ms) => window.__gorget(window.__lepes(i), ms), i, i === 0 ? 1200 : (n.lepesGorget || 900));
    await varj(i === db - 1 ? (n.vegVar || 3000) : (n.lepesVar || 2200));
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
