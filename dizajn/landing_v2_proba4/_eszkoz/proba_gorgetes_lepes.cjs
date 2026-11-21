// Próba: a "Mit kapsz" ragadós bemutató telefonon görgetésenként egy lépést lép-e (kod/landing/dist/index.html, fejetlen Chrome).
// Telefon: 390x844 @2, isMobile, hasTouch. Érintés: nyers CDP touch-események pontos időbélyeggel (a puppeteer touchscreen
// időbélyeg nélkül küld, ezért a lendület becslése ingadozik), valamint a puppeteer touchscreen is; scrollBy; wheel.
// Gép: 1440x900 és keskeny asztali ablak (400x900, egér): nincs beakadás.
const { pathToFileURL } = require('url');
const puppeteer = require('C:/Users/UpgradePC/konyvelo_app/kod/panel/node_modules/puppeteer-core');
const CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const OLDAL = pathToFileURL('C:/Users/UpgradePC/konyvelo_app/kod/landing/dist/index.html').href;
const varj = ms => new Promise(r => setTimeout(r, ms));

async function nyugszik(page, max = 6000) {
  let y = await page.evaluate(() => scrollY), t = Date.now(), stabil = Date.now();
  while (Date.now() - t < max) {
    await varj(50);
    const y2 = await page.evaluate(() => scrollY);
    if (Math.abs(y2 - y) > 0.5) { y = y2; stabil = Date.now(); }
    else if (Date.now() - stabil > 500) break;
  }
  return y;
}
async function allapot(page) {
  return page.evaluate(() => {
    const pont = (p) => scrollY + p.getBoundingClientRect().top - (parseFloat(getComputedStyle(p).scrollMarginTop) || 0);
    return {
      y: scrollY,
      lepes: [...document.querySelectorAll('.blepesek > .blepes')].findIndex(l => l.classList.contains('aktiv')),
      beakad: document.documentElement.classList.contains('beakad'),
      vegen: document.querySelector('.szinpad').classList.contains('vegen'),
      nyil: getComputedStyle(document.querySelector('.szinpad-nyil')).opacity,
      pontok: [...document.querySelectorAll('.blepes > .beakado:not(.beakado-ki)')].map(pont),
      ki: pont(document.querySelector('.beakado-ki')),
      be: pont(document.querySelector('.beakado-be')),
      max: document.documentElement.scrollHeight - innerHeight,
    };
  });
}
function hol(a) {
  const i = a.pontok.findIndex(p => Math.abs(p - a.y) <= 2);
  if (i >= 0) return 'L' + i;
  if (Math.abs(a.ki - a.y) <= 2) return 'KI';
  if (Math.abs(a.be - a.y) <= 2) return 'BE';
  return 'szabad@' + Math.round(a.y);
}

(async () => {
  const browser = await puppeteer.launch({ executablePath: CHROME, headless: true, args: ['--hide-scrollbars', '--allow-file-access-from-files'] });
  const hibak = [], eredmeny = {};
  async function lap(w, h, dpr, mobil) {
    const page = await browser.newPage();
    page.on('pageerror', e => hibak.push(`${w}: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error' || m.type() === 'warn') hibak.push(`${w} konzol ${m.type()}: ${m.text()} ${m.location()?.url || ''}`); });
    page.on('requestfailed', r => hibak.push(`${w} sikertelen kérés: ${r.url()}`));
    // a statisztika szkriptjét (/m/script.js) élesben a szerver adja; file:// alatt üres választ kap (különben 404 a konzolon)
    await page.setRequestInterception(true);
    page.on('request', r => r.url().endsWith('/m/script.js') ? r.respond({ status: 200, contentType: 'text/javascript', body: '' }) : r.continue());
    await page.emulate({ viewport: { width: w, height: h, deviceScaleFactor: dpr, isMobile: mobil, hasTouch: mobil },
      userAgent: mobil ? 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/157 Mobile Safari/537.36' : await browser.userAgent() });
    await page.goto(OLDAL, { waitUntil: 'networkidle0', timeout: 60000 });
    await page.evaluate(async () => {
      await document.fonts.ready;
      for (const img of document.images) img.loading = 'eager';
      await Promise.all([...document.images].map(i => i.complete ? 0 : new Promise(r => { i.onload = i.onerror = r; })));
    });
    await varj(300);
    return page;
  }
  async function kilogas(page) {
    return page.evaluate(() => {
      const b = document.body, regi = b.style.overflowX;
      b.style.overflowX = 'visible';
      const sw = document.documentElement.scrollWidth, cw = document.documentElement.clientWidth;
      const kilog = [];
      if (sw > cw) for (const el of document.querySelectorAll('body *')) { const r = el.getBoundingClientRect(); if (r.width && r.right > cw + 1) kilog.push((el.className || el.tagName) + ' ' + Math.round(r.right)); }
      b.style.overflowX = regi;
      return { scrollWidth: sw, clientWidth: cw, kilog: kilog.slice(0, 8) };
    });
  }

  // ---------- telefon ----------
  {
    const page = await lap(390, 844, 2, true);
    const cdp = await page.target().createCDPSession();
    const a0 = await allapot(page);
    eredmeny.pontok = { BE: Math.round(a0.be), L: a0.pontok.map(Math.round), KI: Math.round(a0.ki), lepesTav: Math.round(a0.pontok[1] - a0.pontok[0]) };
    eredmeny.kilogas390 = await kilogas(page);
    const naplo = [];
    async function mozdulat(nev, f, varhato) {
      const e = await allapot(page);
      await f();
      await nyugszik(page);
      await varj(120);
      const u = await allapot(page);
      const sor = { nev, honnan: hol(e), hova: hol(u), lepes: `${e.lepes}->${u.lepes}`, beakad: u.beakad, nyil: u.nyil };
      if (varhato) sor.jo = !!varhato(e, u);
      naplo.push(sor);
      return u;
    }
    const ugrik = async (y) => { await page.evaluate((y) => { document.documentElement.style.scrollBehavior = 'auto'; scrollTo(0, y); document.documentElement.style.scrollBehavior = ''; }, y); await nyugszik(page); await varj(150); };
    const egyLe = (e, u) => u.lepes === e.lepes + 1 && hol(u) === 'L' + u.lepes;
    const egyFel = (e, u) => u.lepes === e.lepes - 1 && hol(u) === 'L' + u.lepes;
    // dy > 0: lefelé görget (az ujj felfelé húz); lepes db mozdulat, ms-onként
    const erint = (dy, lepes = 6, ms = 16, x = 200, y0 = 560) => async () => {
      const t0 = Date.now() / 1000, pt = (y) => [{ x, y, radiusX: 4, radiusY: 4, force: 1, id: 1 }];
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pt(y0), timestamp: t0 });
      for (let i = 1; i <= lepes; i++) { await varj(ms); await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pt(y0 - dy * i / lepes), timestamp: t0 + i * ms / 1000 }); }
      await varj(8);
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [], timestamp: t0 + (lepes * ms + 8) / 1000 });
    };
    const ptHuz = (dy, lepes = 6, ms = 14) => async () => {
      await page.touchscreen.touchStart(200, 560);
      for (let i = 1; i <= lepes; i++) { await page.touchscreen.touchMove(200, 560 - dy * i / lepes); await varj(ms); }
      await page.touchscreen.touchEnd();
    };

    // 1) a szakasz előtt szabad a görgetés
    await ugrik(a0.be - 900);
    await mozdulat('elotte: scrollBy +100', () => page.evaluate(() => scrollBy(0, 100)), (e, u) => !u.beakad && Math.abs(u.y - e.y - 100) < 2);
    await mozdulat('elotte: erintes 150px (lendulettel)', erint(150), (e, u) => !u.beakad && u.y > e.y + 140);
    // 2) belépés a szakasz tetejéről, majd lépésenként le, váltakozó mozdulatokkal
    await ugrik(a0.be);
    await mozdulat('BE -> le: legyintes 120px', erint(120), (e, u) => hol(u) === 'L0' && u.beakad);
    const le = [
      ['legyintes 30px nagyon rovid (2x8 ms)', erint(30, 2, 8)],
      ['legyintes 60px', erint(60, 4)],
      ['legyintes 200px', erint(200, 6)],
      ['legyintes 600px nagyon eros', erint(600, 6, 12)],
      ['puppeteer touchscreen 120px', ptHuz(120)],
      ['scrollBy +60', () => page.evaluate(() => scrollBy(0, 60))],
      ['scrollBy +2000', () => page.evaluate(() => scrollBy(0, 2000))],
    ];
    for (const [nev, f] of le) await mozdulat('le: ' + nev, f, egyLe);
    // 3) az utolsó lépésről tovább (KI pont: a színpad elenged), onnan szabadon
    await mozdulat('L7 -> le: legyintes 150px', erint(150), (e, u) => hol(u) === 'KI' && !u.beakad);
    await mozdulat('KI -> le: legyintes 150px (szabad tovabb)', erint(150), (e, u) => !u.beakad && u.y > e.y + 140);
    // 4) visszafelé: KI-re, onnan fel lépésenként
    await ugrik(a0.ki);
    await mozdulat('KI -> fel: legyintes 120px', erint(-120), (e, u) => hol(u) === 'L7' && u.beakad);
    const fel = [
      ['legyintes 30px nagyon rovid', erint(-30, 2, 8)],
      ['legyintes 600px nagyon eros', erint(-600, 6, 12)],
      ['puppeteer touchscreen 120px', ptHuz(-120)],
      ['scrollBy -60', () => page.evaluate(() => scrollBy(0, -60))],
      ['scrollBy -2000', () => page.evaluate(() => scrollBy(0, -2000))],
      ['legyintes 200px', erint(-200)],
      ['legyintes 60px', erint(-60, 4)],
    ];
    for (const [nev, f] of fel) await mozdulat('fel: ' + nev, f, egyFel);
    await mozdulat('L0 -> fel: legyintes 120px', erint(-120), (e, u) => hol(u) === 'BE' && !u.beakad);
    await mozdulat('BE -> fel: legyintes 150px (szabad)', erint(-150), (e, u) => !u.beakad && u.y < e.y - 140);
    // 5) lassú húzás lendület nélkül: nem áll meg két lépés között (a közelebbi lépésre ugrik)
    await ugrik(a0.pontok[3]);
    await mozdulat('L3: lassu huzas 100px lendulet nelkul', erint(100, 10, 40), (e, u) => /^L\d$/.test(hol(u)));
    await mozdulat('L3: lassu huzas 300px lendulet nelkul', erint(300, 20, 40), (e, u) => /^L\d$/.test(hol(u)));
    await mozdulat('L?: lassu huzas 450px lendulet nelkul', erint(450, 30, 40), (e, u) => /^L\d$/.test(hol(u)));
    // 6) egérgörgő (CDP wheel = pontos képpont-delta, mint egy tehetetlenség nélküli touchpad) a telefon-emulációban
    await ugrik(a0.pontok[3]);
    await page.mouse.move(200, 500);
    await mozdulat('wheel +100 (telefonon nincs gorgo)', () => page.mouse.wheel({ deltaY: 100 }), (e, u) => /^L\d$/.test(hol(u)));
    await mozdulat('wheel +500', () => page.mouse.wheel({ deltaY: 500 }), (e, u) => /^L\d$/.test(hol(u)));
    await mozdulat('wheel +1200', () => page.mouse.wheel({ deltaY: 1200 }), (e, u) => /^L\d$/.test(hol(u)));
    // 7) menü-linkek a szakaszból: oda visznek, ahová kell
    await ugrik(a0.pontok[4]);
    const arakCel = await page.evaluate(() => { const s = document.getElementById('arak'); return scrollY + s.getBoundingClientRect().top - (parseFloat(getComputedStyle(s).scrollMarginTop) || 0); });
    const menu = (hash) => async () => {
      await page.evaluate(() => document.querySelector('.mobilmenu summary').click());
      await varj(250);
      await page.evaluate((h) => [...document.querySelectorAll('.mobilmenu-lap a')].find(a => a.getAttribute('href') === h).click(), hash);
    };
    await mozdulat('menu link #arak (L4-rol)', menu('#arak'), (e, u) => Math.abs(u.y - arakCel) < 3 && !u.beakad);
    await mozdulat('menu link #mit-kapsz (lentrol)', menu('#mit-kapsz'), (e, u) => hol(u) === 'BE');
    await ugrik(a0.pontok[5]);
    const hogyanCel = await page.evaluate(() => { const s = document.getElementById('hogyan'); return scrollY + s.getBoundingClientRect().top - (parseFloat(getComputedStyle(s).scrollMarginTop) || 0); });
    await mozdulat('menu link #hogyan (L5-rol, felfele)', menu('#hogyan'), (e, u) => !u.beakad && Math.abs(u.y - hogyanCel) < 3);
    // 8) 8 egymás utáni legyintés a szakasz elejétől: mindegyik pontosan egy lépés, a végén továbbmegy
    await ugrik(a0.be);
    const sor = [];
    for (let i = 0; i < 10; i++) { const e = await allapot(page); await erint(140)(); await nyugszik(page); await varj(100); const u = await allapot(page); sor.push(`${hol(e)}->${hol(u)}`); }
    eredmeny.tizLegyintes = sor.join(' ');
    eredmeny.naplo = naplo;
    eredmeny.mindJo = naplo.every(s => s.jo !== false);
    eredmeny.rossz = naplo.filter(s => s.jo === false).map(s => s.nev);
    await page.close();
  }

  // ---------- keskeny asztali ablak egérrel (400x900): nincs beakadás, a görgő szabadon görget ----------
  {
    const page = await lap(400, 900, 1, false);
    const a0 = await allapot(page);
    await page.evaluate((y) => { document.documentElement.style.scrollBehavior = 'auto'; scrollTo(0, y); }, a0.pontok[2]);
    await page.mouse.move(200, 500);
    const r = [];
    for (const dy of [100, 100, 300]) { const e = await page.evaluate(() => scrollY); await page.mouse.wheel({ deltaY: dy }); const u = await nyugszik(page); r.push({ wheel: dy, elmozdult: Math.round(u - e), beakad: await page.evaluate(() => document.documentElement.classList.contains('beakad')) }); }
    eredmeny.keskenyAsztali = r;
    eredmeny.keskenyAsztaliSzabad = r.every(x => !x.beakad && Math.abs(x.elmozdult - x.wheel) < 2);
    eredmeny.nyilLatszik400 = await page.evaluate(() => getComputedStyle(document.querySelector('.szinpad-nyil')).display);
    await page.close();
  }
  // ---------- gép 1440 ----------
  {
    const page = await lap(1440, 900, 1, false);
    eredmeny.kilogas1440 = await kilogas(page);
    const s0 = await page.evaluate(() => scrollY + document.querySelector('[data-bemutato]').getBoundingClientRect().top);
    await page.evaluate((y) => { document.documentElement.style.scrollBehavior = 'auto'; scrollTo(0, y); }, s0 + 300);
    await page.mouse.move(700, 450);
    const r = [];
    for (const dy of [100, 37, 500]) { const e = await page.evaluate(() => scrollY); await page.mouse.wheel({ deltaY: dy }); const u = await nyugszik(page); r.push({ wheel: dy, elmozdult: Math.round(u - e), beakad: await page.evaluate(() => document.documentElement.classList.contains('beakad')) }); }
    eredmeny.gep1440 = r;
    eredmeny.gepSzabad = r.every(x => !x.beakad && Math.abs(x.elmozdult - x.wheel) < 2);
    eredmeny.nyil1440 = await page.evaluate(() => getComputedStyle(document.querySelector('.szinpad-nyil')).display);
    await page.close();
  }
  eredmeny.hibak = hibak;
  console.log(JSON.stringify(eredmeny, null, 1));
  await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
