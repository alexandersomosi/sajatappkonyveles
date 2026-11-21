// Videó a tulajnak (11-21): telefonon a „Mit kapsz” ragadós bemutató görgetésenként egy lépést lép, mellette a mozgó nyíl.
//   node dizajn/landing_v2_proba4/_eszkoz/video_gorgetes_lepes.cjs
// Forrás: kod/landing/dist/index.html (a helyben épített, MÉG NEM telepített oldal). 390x844 @2 (780x1688), érintéses telefon-emuláció.
// Felvétel valós időben (CDP Page.startScreencast, a kockák időbélyegével), mert a beakadás animációját a böngésző maga futtatja
// (nem lassítható). Az érintés nyers CDP touch-esemény pontos időbélyeggel (rövid legyintés). A legyintést egy rárajzolt
// ujjnyom jelzi (csak a felvételen, az oldalnak nem része; pointer-events: none).
// Forgatókönyv (kb. 30 s): a szakasz teteje (a nyíl pattog) -> 8 legyintés, mindegyik után megáll egy lépésen (1..8) ->
// 9. legyintés: a színpad elenged -> 10.: szabadon tovább a következő részre.
// Kimenet: _proba_kepek/gorgetes_lepes_telefon.mp4 + gorgetes_lepes_nyil.png (állókép, a nyíl a telefon mellett).
const path = require('path'), fs = require('fs'), os = require('os');
const { pathToFileURL } = require('url');
const { execFileSync } = require('child_process');
const puppeteer = require(path.resolve(__dirname, '../../../kod/panel/node_modules/puppeteer-core'));
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(f => fs.existsSync(f));
const FFMPEG = 'D:/Programs/ffmpeg/bin/ffmpeg.exe';
const OLDAL = pathToFileURL(path.resolve(__dirname, '../../../kod/landing/dist/index.html')).href;
const KI = path.resolve(__dirname, '../_proba_kepek');
const VIDEO = path.join(KI, 'gorgetes_lepes_telefon.mp4'), ALLO = path.join(KI, 'gorgetes_lepes_nyil.png');
const varj = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars', '--allow-file-access-from-files'] });
  const page = await browser.newPage();
  const hibak = [];
  page.on('pageerror', e => hibak.push(e.message));
  page.on('console', m => { if (m.type() === 'error') hibak.push('konzol: ' + m.text()); });
  // a statisztika szkriptjét (/m/script.js) élesben a szerver adja; helyben üres választ kap
  await page.setRequestInterception(true);
  page.on('request', r => r.url().endsWith('/m/script.js') ? r.respond({ status: 200, contentType: 'text/javascript', body: '' }) : r.continue());
  await page.emulate({ viewport: { width: 390, height: 844, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
    userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157 Mobile Safari/537.36' });
  await page.goto(OLDAL, { waitUntil: 'networkidle0', timeout: 60000 });
  const pontok = await page.evaluate(async () => {
    await document.fonts.ready;
    for (const img of document.images) img.loading = 'eager';
    await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
    // a felvételre rajzolt ujjnyom (csak transform/opacity; nem fogja el az érintést)
    const u = document.createElement('div');
    u.id = 'felvetel-ujj';
    Object.assign(u.style, { position: 'fixed', left: '0', top: '0', width: '46px', height: '46px', marginLeft: '-23px', marginTop: '-23px',
      borderRadius: '50%', background: 'rgba(255,255,255,.28)', boxShadow: '0 0 0 2px rgba(255,255,255,.75), 0 4px 18px rgba(0,0,0,.35)',
      pointerEvents: 'none', zIndex: '9999', opacity: '0' });
    document.body.appendChild(u);
    // a fejetlen screencast csak akkor küld kockát, ha a kép változik, és egy áttűnés utolsó kockája így elveszhet (a videóban
    // „megfagyott” félkész kép). Egy láthatatlan, 1 px-es, folyton mozgó pont miatt a kockák folyamatosan jönnek.
    const ketyego = document.createElement('div');
    Object.assign(ketyego.style, { position: 'fixed', left: '0', bottom: '0', width: '1px', height: '1px', background: '#000', opacity: '.01', pointerEvents: 'none', zIndex: '9998' });
    document.body.appendChild(ketyego);
    ketyego.animate([{ opacity: .01 }, { opacity: .02 }], { duration: 200, iterations: Infinity, direction: 'alternate' });
    window.__ujj = (x, y0, y1, ms) => u.animate([
      { opacity: 0, transform: `translate(${x}px, ${y0}px) scale(.8)` },
      { opacity: 1, transform: `translate(${x}px, ${y0}px) scale(1)`, offset: .3 },
      { opacity: 1, transform: `translate(${x}px, ${y1}px) scale(1)`, offset: .75 },
      { opacity: 0, transform: `translate(${x}px, ${y1}px) scale(.9)` },
    ], { duration: ms, easing: 'linear', fill: 'forwards' });
    const hol = (p) => scrollY + p.getBoundingClientRect().top - (parseFloat(getComputedStyle(p).scrollMarginTop) || 0);
    return { be: hol(document.querySelector('.beakado-be')), l: [...document.querySelectorAll('.blepes > .beakado:not(.beakado-ki)')].map(hol), ki: hol(document.querySelector('.beakado-ki')) };
  });
  const cdp = await page.target().createCDPSession();
  // állókép: a 2. lépésen, a nyíl a telefon mellett
  await page.evaluate((y) => { document.documentElement.style.scrollBehavior = 'auto'; scrollTo(0, y); document.documentElement.style.scrollBehavior = ''; }, pontok.l[1]);
  await varj(2600);
  await page.screenshot({ path: ALLO });
  // a szakasz tetejére (ahová a menü „Mit kapsz” linkje visz)
  await page.evaluate((y) => { document.documentElement.style.scrollBehavior = 'auto'; scrollTo(0, y); document.documentElement.style.scrollBehavior = ''; }, pontok.be);
  await varj(1200);

  // legyintés: dy px lefelé görgetés (az ujj felfelé húz), 8 mozdulat 15 ms-onként, pontos időbélyeggel
  async function legyint(dy = 150, x = 300, y0 = 640) {
    const lepes = 8, ms = 15, hossz = lepes * ms;
    await page.evaluate((x, y0, y1, d) => window.__ujj(x, y0, y1, d), x, y0, y0 - dy, hossz + 420);
    await varj(130);
    const t0 = Date.now() / 1000, pt = (y) => [{ x, y, radiusX: 6, radiusY: 6, force: 1, id: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(y0), timestamp: t0 });
    for (let i = 1; i <= lepes; i++) { await varj(ms); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(y0 - dy * i / lepes), timestamp: t0 + i * ms / 1000 }); }
    await varj(8);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [], timestamp: t0 + (hossz + 8) / 1000 });
  }

  // felvétel
  const mappa = fs.mkdtempSync(path.join(os.tmpdir(), 'adozz_gorgetes_'));
  const kockak = [];
  cdp.on('Page.screencastFrame', async ({ data, metadata, sessionId }) => {
    const f = path.join(mappa, `k${String(kockak.length).padStart(5, '0')}.jpg`);
    fs.writeFileSync(f, Buffer.from(data, 'base64'));
    kockak.push({ f, t: metadata.timestamp });
    try { await cdp.send('Page.screencastFrameAck', { sessionId }); } catch (e) { /* vége */ }
  });
  await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 88, maxWidth: 780, maxHeight: 1688, everyNthFrame: 1 });
  const naplo = [];
  const allas = async () => page.evaluate((p) => {
    const y = scrollY, i = p.l.findIndex(v => Math.abs(v - y) <= 2);
    const lepes = [...document.querySelectorAll('.blepesek > .blepes')].findIndex(l => l.classList.contains('aktiv'));
    return (i >= 0 ? 'L' + i : Math.abs(p.ki - y) <= 2 ? 'KI' : Math.abs(p.be - y) <= 2 ? 'BE' : 'szabad@' + Math.round(y)) + ` (aktív lépés: ${lepes + 1})`;
  }, pontok);
  const t0 = Date.now();
  await varj(3000);                                   // a szakasz teteje: a nyíl pattog
  for (let i = 0; i < 8; i++) {                       // 8 legyintés: BE -> 1. lépés ... 7. -> 8. lépés
    await legyint(150);
    await varj(i === 0 ? 2600 : 2500);
    naplo.push(`${i + 1}. legyintés után: ${await allas()}`);
  }
  await legyint(150); await varj(1900);              // 9.: a színpad elenged (a lista vége)
  naplo.push(`9. legyintés után: ${await allas()}`);
  await legyint(260); await varj(2200);              // 10.: szabadon tovább
  naplo.push(`10. legyintés után: ${await allas()}`);
  await cdp.send('Page.stopScreencast');
  await varj(300);
  const valosHossz = (Date.now() - t0) / 1000;

  // kockák -> 30 fps H.264 (a kockák a saját időbélyegük szerint tartanak)
  const lista = [];
  for (let i = 0; i < kockak.length; i++) {
    const d = i + 1 < kockak.length ? Math.max(0.001, kockak[i + 1].t - kockak[i].t) : 0.5;
    lista.push(`file '${kockak[i].f.replace(/\\/g, '/')}'`, `duration ${d.toFixed(4)}`);
  }
  lista.push(`file '${kockak[kockak.length - 1].f.replace(/\\/g, '/')}'`);
  const listaF = path.join(mappa, 'lista.txt');
  fs.writeFileSync(listaF, lista.join('\n'));
  execFileSync(FFMPEG, ['-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', listaF, '-vf', 'fps=30,scale=780:1688:flags=lanczos:in_range=pc:out_range=tv,format=yuv420p',
    '-pix_fmt', 'yuv420p', '-color_range', 'tv', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709',
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '20', '-movflags', '+faststart', VIDEO]);
  console.log(JSON.stringify({ video: VIDEO, allokep: ALLO, kockak: kockak.length, valosHossz, naplo, hibak, ideiglenes: mappa }, null, 1));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
