// Külső Gemini-átnézéshez (11-21): a dist/index.html szeletei + a látható szöveg szakaszonként.
// A tulaj_kep_b.cjs mintája: csökkentett mozgás, a ragadós bemutató egy képernyőnyire csukva (teljes_kep_stilus.cjs),
// a figyelők letiltva, a ragadós elemek a helyükön, minden szelet előtt odagörget és a nézetből fotóz.
// node kulso_kep.cjs <html> <kimeneti előtag> <szélesség> <dpr> <szeletszám> <képernyő-magasság> [szoveg.json]
const path = require('path'), fs = require('fs');
const { pathToFileURL } = require('url');
const puppeteer = require('C:/Users/UpgradePC/konyvelo_app/kod/panel/node_modules/puppeteer-core');
const teljesKepStilus = require('C:/Users/UpgradePC/konyvelo_app/dizajn/landing_v2_proba4/_eszkoz/teljes_kep_stilus.cjs');
const CHROME = ['C:/Program Files/Google/Chrome/Application/chrome.exe', 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'].find(f => fs.existsSync(f));
const [, , html, ki, szel, dpr, darab, vhArg, szovegKi] = process.argv;
const VH = +(vhArg || 900);
(async () => {
  const b = await puppeteer.launch({ executablePath: CHROME, headless: 'new', args: ['--hide-scrollbars', '--allow-file-access-from-files'] });
  const p = await b.newPage(); const hibak = [];
  p.on('console', m => { if (m.type() === 'error') hibak.push(m.text()); }); p.on('pageerror', e => hibak.push(String(e)));
  await p.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  await p.setViewport({ width: +szel, height: VH, deviceScaleFactor: +dpr });
  await p.goto(pathToFileURL(path.resolve(html)).href, { waitUntil: 'networkidle0', timeout: 60000 });

  // ---- a látható szöveg szakaszonként (eredeti stílussal, a GYIK lenyitva), külön lapon, hogy a képeket ne zavarja ----
  if (szovegKi) {
    const t = await b.newPage();
    await t.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
    await t.setViewport({ width: +szel, height: VH, deviceScaleFactor: 1 });
    await t.goto(pathToFileURL(path.resolve(html)).href, { waitUntil: 'networkidle0', timeout: 60000 });
    const szoveg = await t.evaluate(() => {
      for (const d of document.querySelectorAll('details')) d.open = true;
      const jel = (e, s) => e.insertBefore(document.createTextNode(s), e.firstChild);
      for (const e of document.querySelectorAll('h1')) jel(e, '# ');
      for (const e of document.querySelectorAll('h2')) jel(e, '## ');
      for (const e of document.querySelectorAll('h3')) jel(e, '### ');
      for (const e of document.querySelectorAll('li')) jel(e, '- ');
      for (const e of document.querySelectorAll('summary')) jel(e, '[kérdés] ');
      for (const i of document.querySelectorAll('img[alt]')) { const a = i.getAttribute('alt').trim(); if (a && i.checkVisibility()) { const s = document.createElement('span'); s.textContent = ` [kép: ${a}] `; i.after(s); } }
      const ki = [];
      for (const s of document.querySelectorAll('body > header, body > main > section, body > section, body > footer, main > header, main > footer, body > main > *')) {
        if (!['HEADER', 'SECTION', 'FOOTER'].includes(s.tagName) || ki.some(k => k.el === s)) continue;
        const cim = s.id || (s.getAttribute('class') || s.tagName).split(' ')[0];
        ki.push({ el: s, szakasz: cim, szoveg: s.innerText.replace(/\u00ad/g, '').replace(/\u00a0/g, ' ').replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim() });
      }
      return ki.map(({ szakasz, szoveg }) => ({ szakasz, szoveg }));
    });
    fs.writeFileSync(szovegKi, JSON.stringify(szoveg, null, 1), 'utf8');
    await t.close();
  }

  await p.addStyleTag({ content: teljesKepStilus(VH) });
  await p.evaluate(() => { const all = e => e.stopImmediatePropagation(); window.addEventListener('scroll', all, true); window.addEventListener('resize', all, true); });
  await p.waitForFunction(() => { const b = document.querySelector('.bemutato .blepes'); return !b || !matchMedia('(max-width: 980px)').matches || b.offsetHeight === 0; }, { timeout: 8000, polling: 100 })
    .catch(() => hibak.push('a teljes oldalas kép stílusa nem érvényesült'));
  await p.evaluate(async () => { await document.fonts.ready; for (const i of document.images) { i.loading = 'eager'; if (!i.complete) await new Promise(r => { i.onload = i.onerror = r; }); } });
  await p.evaluate(() => window.scrollTo(0, 0)); await new Promise(r => setTimeout(r, 800));
  const H = await p.evaluate(() => document.documentElement.scrollHeight);
  const ragados = await p.evaluate(() => { let db = 0; for (const e of document.querySelectorAll('body *')) if (getComputedStyle(e).position === 'sticky') { e.style.setProperty('position', 'relative', 'important'); e.style.setProperty('top', 'auto', 'important'); db++; } return db; });
  const allapot = await p.evaluate(() => { window.__all = [...document.querySelectorAll('.bemutato, .bemutato *')].map(e => [e, e.getAttribute('class'), e.style.transform]); return window.__all.length; });
  const szelet = Math.ceil(H / +darab);
  let n = 0; const helyek = [];
  for (let y = 0; y < H; y += szelet) { n++; const m = Math.min(szelet, H - y);
    await p.setViewport({ width: +szel, height: m, deviceScaleFactor: +dpr });
    await p.evaluate(y => window.scrollTo(0, y), y); await new Promise(r => setTimeout(r, 250));
    await p.evaluate(() => { for (const [e, c, t] of window.__all) { if (c === null) e.removeAttribute('class'); else e.setAttribute('class', c); e.style.transform = t; } });
    await new Promise(r => setTimeout(r, 450));
    const v = await p.evaluate(() => window.scrollY); if (Math.abs(v - y) > 1) hibak.push('görgetés ' + y + ' helyett ' + v);
    // melyik szakaszok látszanak ezen a szeleten (a Gemininek felirat)
    const lat = await p.evaluate((y, m) => [...document.querySelectorAll('header, section, footer')].filter(s => !s.parentElement.closest('section, header, footer'))
      .map(s => { const r = s.getBoundingClientRect(); const a = r.top + window.scrollY; return { id: s.id || (s.getAttribute('class') || s.tagName).split(' ')[0], a, f: a + r.height }; })
      .filter(s => s.f > y + 40 && s.a < y + m - 40).map(s => s.id), y, m);
    helyek.push({ n, y, m, szakaszok: lat });
    await p.screenshot({ path: `${ki}_${String(n).padStart(2, '0')}.png` }); }
  console.log(JSON.stringify({ H, szelet, n, allapot, ragados, helyek, hibak })); await b.close();
})();
