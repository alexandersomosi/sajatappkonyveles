// 3. kör (javító, 11-21): képek a tulajnak a hős 4 menü-állapotáról és a ragadós bemutató zárólépéséről.
// node _eszkoz/hos_zaro_kep.cjs [kimeneti mappa]   (alapból _kepek_tulajnak/kor3)
//   hero_gep_1..4.png      1440x900 @2: a telefon menüjére kattintva (1 Főoldal, 2 Dosszié, 3 Fotózás, 4 Üzenetek); a böngészőablak is vált
//   hero_telefon_1..4.png  390x844 @2, érintéssel (koppintás a telefon menüjére), a hős kompozíciója a képernyő közepén
//   zaro_gep.png / zaro_telefon.png: a „Gépen is ugyanez” zárólépés (1440x900 @2, 390x844 @2)
// Mozgással fut (nem csökkentett), a váltások után megvárja az áttűnést. Közben ellenőrzi: a telefon és a böngésző ugyanazt mutatja-e,
// aria-pressed, gépes mód a zárólépésnél, vízszintes kilógás, konzolhiba.
const path = require('path'), fs = require('fs');
const { pathToFileURL } = require('url');
const puppeteer = require(path.resolve(__dirname, '../../../kod/panel/node_modules/puppeteer-core'));
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(f => fs.existsSync(f));
const GYOKER = path.join(__dirname, '..');
const KI = path.resolve(process.argv[2] || path.join(GYOKER, '_kepek_tulajnak/kor3'));
const OLDAL = pathToFileURL(path.join(GYOKER, 'index.html')).href;
const varj = ms => new Promise(r => setTimeout(r, ms));
const NEZETEK = [
  { nev: 'gep', w: 1440, h: 900, dpr: 2, erintes: false },
  { nev: 'telefon', w: 390, h: 844, dpr: 2, erintes: true },
];
(async () => {
  fs.mkdirSync(KI, { recursive: true });
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars', '--allow-file-access-from-files'] });
  let hiba = 0;
  for (const n of NEZETEK) {
    const p = await b.newPage();
    const naplo = [];
    p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') naplo.push(m.type() + ': ' + m.text()); });
    p.on('pageerror', e => naplo.push('JS-hiba: ' + e.message));
    p.on('requestfailed', r => naplo.push('betöltés: ' + r.url().slice(0, 90)));
    await p.emulate({ viewport: { width: n.w, height: n.h, deviceScaleFactor: n.dpr, isMobile: n.erintes, hasTouch: n.erintes },
      userAgent: n.erintes ? 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Mobile Safari/537.36' : await b.userAgent() });
    await p.goto(OLDAL, { waitUntil: 'networkidle0', timeout: 60000 });
    // (a lusta képek nem töltődnek be, amíg nem látszanak: csak a betűre és a hős képeire várunk)
    await p.evaluate(async () => { await document.fonts.ready; await Promise.all([...document.querySelectorAll('.kompo-hos img')].filter(i => !i.complete).map(i => new Promise(r => { i.onload = i.onerror = r; }))); });
    // a hős kompozíciója a képben (telefonon a fejléc alatt, középen)
    await p.evaluate(() => {
      const k = document.querySelector('.kompo-hos').getBoundingClientRect(), fej = document.querySelector('.fejlec').offsetHeight;
      if (k.bottom > innerHeight) scrollTo({ top: Math.max(0, scrollY + k.top - fej - (innerHeight - fej - k.height) / 2), behavior: 'instant' });
    });
    await varj(3600);   // a betöltés utáni egyszeri gyűrű lefut (és eltűnik)
    const gombok = await p.evaluate(() => [...document.querySelectorAll('.hos-menu button')].map(g => { const r = g.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }));
    const eredmeny = [];
    for (const [sorszam, i] of [[2, 1], [3, 2], [4, 3], [1, 0]]) {
      const [x, y] = gombok[i];
      if (n.erintes) await p.touchscreen.tap(x, y); else await p.mouse.click(x, y);
      await p.mouse.move(5, 5);   // a hover ne maradjon a gombon
      await varj(700);
      const all = await p.evaluate(() => ({
        kepek: [...document.querySelectorAll('.kompo-hos .valto')].map(v => [...v.querySelectorAll(':scope > img')].findIndex(i => i.classList.contains('aktiv'))),
        nyomva: [...document.querySelectorAll('.hos-menu button')].findIndex(g => g.getAttribute('aria-pressed') === 'true'),
      }));
      const jo = all.kepek.every(x => x === i) && all.nyomva === i;
      if (!jo) { naplo.push(`${sorszam}. állapot hibás: ${JSON.stringify(all)}`); }
      eredmeny.push(`${sorszam}:${jo ? 'ok' : 'HIBA'}`);
      await p.screenshot({ path: path.join(KI, `hero_${n.nev}_${sorszam}.png`) });
    }
    // zárólépés: odagörgetünk (máshonnan érkezve), és megvárjuk, amíg a böngészőablak beúszik
    const zaro = await p.evaluate(async () => {
      const l = [...document.querySelectorAll('.bemutato .blepes')], sp = document.querySelector('.szinpad');
      const y = el => el.getBoundingClientRect().top + scrollY, nn = l.length, i = nn - 1;
      let cel;
      if (matchMedia('(min-width: 981px)').matches) cel = y(l[i]) + l[i].offsetHeight / 2 - innerHeight / 2;
      else { const fent = parseFloat(getComputedStyle(sp).top) || 0; const hossz = y(l[nn - 1]) + l[nn - 1].offsetHeight - y(l[0]) - sp.offsetHeight; cel = y(l[0]) - fent + hossz * (i + 0.5) / nn; }
      scrollTo({ top: cel - innerHeight * 0.4, behavior: 'instant' }); await new Promise(r => setTimeout(r, 400));
      scrollTo({ top: cel, behavior: 'instant' }); await new Promise(r => setTimeout(r, 1600));
      return { gepMod: sp.classList.contains('gep-mod'), szeles: document.documentElement.scrollWidth };
    });
    if (!zaro.gepMod) naplo.push('a zárólépésnél nincs gépes mód');
    if (zaro.szeles > n.w) naplo.push('vízszintesen kilóg: ' + zaro.szeles);
    await p.screenshot({ path: path.join(KI, `zaro_${n.nev}.png`) });
    console.log(`${n.nev} ${n.w}x${n.h} @${n.dpr}: ${eredmeny.join(' ')} zárólépés:${zaro.gepMod ? 'ok' : 'HIBA'}` + (naplo.length ? '\n  ' + naplo.join('\n  ') : ''));
    if (naplo.length) hiba++;
    await p.close();
  }
  await b.close();
  process.exit(hiba ? 1 : 0);
})();
