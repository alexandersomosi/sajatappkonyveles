// NAV nyilvános (belépés nélküli) képernyők rögzítése + a jelölendő elemek helye (eszköz-pixelben).
// Csak megnyit, lenyit, görget, képet készít. Nem lép be, nem ír be adatot, nem küld be semmit, sütit nem fogad el.
// node rogzit.mjs <kimenet_mappa> [feladat1,feladat2]   (pl. urlap_vegyes) – a kimenet ne a _forras mappa legyen.
// A kész képeket a _nyers/elo_<dátum>/ alá másold (a .json-nal együtt), és az index.json alap.kep mezőjét írd át.
import { createRequire } from 'module';
import fs from 'fs';
import os from 'os';
const require = createRequire('C:/Users/UpgradePC/konyvelo_app/kod/panel/package.json');
const puppeteer = require('puppeteer-core');
const OUT = process.argv[2];
const CSAK = process.argv[3] || '';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function uj(w, h, dpr, mobil = false) {
  const browser = await puppeteer.launch({
    executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: 'new', protocolTimeout: 120000,
    userDataDir: `${os.tmpdir()}/kezjegy_navkep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, args: ['--disable-gpu', '--no-first-run', '--lang=hu-HU'],
  });
  const page = await browser.newPage();
  await page.setViewport({ width: w, height: h, deviceScaleFactor: dpr, isMobile: mobil, hasTouch: mobil });
  await page.setExtraHTTPHeaders({ 'Accept-Language': 'hu-HU,hu;q=0.9' });
  return { browser, page, dpr };
}
const SUTI_EL = () => {
  document.querySelectorAll('.modal--cookie').forEach((m) => m.remove());
  if (!document.querySelector('.modal')) document.querySelectorAll('.modal-backdrop').forEach((x) => x.remove());
  document.body.classList.remove('modal-open');
};
// a legkisebb látható elem, amelynek szövege pontosan t; ha 'utana' adott, az ennél lejjebb lévők közül az első
async function helyek(page, dpr, kerdesek) {
  return page.evaluate((kerdesek, dpr) => {
    const norm = (s) => (s || '').trim().replace(/\s+/g, ' ');
    const lathato = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
    const keres = (t) => [...document.querySelectorAll('body *')].filter((e) => norm(e.innerText) === t && lathato(e))
      .sort((a, b) => { const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(); return ra.width * ra.height - rb.width * rb.height; });
    const out = {};
    for (const k of kerdesek) {
      let el = null;
      if (k.sel) el = document.querySelector(k.sel);
      else {
        let lista = keres(k.t);
        if (k.utana) { const u = keres(k.utana)[0]; if (u) { const ub = u.getBoundingClientRect().bottom; lista = lista.filter((e) => e.getBoundingClientRect().top >= ub - 2).sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top); } }
        el = lista[0] || null;
      }
      if (!el) { out[k.nev] = null; continue; }
      let r = el.getBoundingClientRect();
      if (k.szulo) { let p = el; for (let i = 0; i < k.szulo && p.parentElement; i++) p = p.parentElement; r = p.getBoundingClientRect(); }
      out[k.nev] = [r.left * dpr, r.top * dpr, r.right * dpr, r.bottom * dpr].map((v) => Math.round(v));
    }
    return out;
  }, kerdesek, dpr);
}
async function megorokit(page, dpr, nev, kerdesek, meta) {
  const rects = await helyek(page, dpr, kerdesek);
  await page.screenshot({ path: `${OUT}/${nev}.png` });
  const info = { nev, url: page.url(), cim: await page.title(), ido: new Date().toISOString(), dpr, viewport: page.viewport(), helyek: rects, ...meta };
  fs.writeFileSync(`${OUT}/${nev}.json`, JSON.stringify(info, null, 1), 'utf8');
  console.log(nev, JSON.stringify(rects));
}
async function ujegykeUrlap(w, h) {
  const k = await uj(w, h, 2);
  await k.page.goto('https://onya-public.nav.gov.hu/#!/', { waitUntil: 'networkidle2', timeout: 60000 });
  await sleep(4000); await k.page.evaluate(SUTI_EL);
  await k.page.evaluate(() => { const a = document.querySelector('dap-ds-accordion'); a.shadowRoot.querySelector('button').click(); });
  await sleep(2500);
  return k;
}
async function valodiKatt(page, t, nth = 0) {
  const box = await page.evaluate((t, nth) => {
    const els = [...document.querySelectorAll('body *')].filter((e) => (e.innerText || '').trim().replace(/\s+/g, ' ') === t && e.getBoundingClientRect().width > 0)
      .sort((a, b) => a.getBoundingClientRect().width * a.getBoundingClientRect().height - b.getBoundingClientRect().width * b.getBoundingClientRect().height);
    const el = els[nth]; if (!el) return null; el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  }, t, nth);
  if (box) { await sleep(500); await page.mouse.click(box.x, box.y); await sleep(2500); }
  return box;
}
async function gorget(page, t, tetejere = 120) {
  await page.evaluate((t, tetejere) => {
    const el = [...document.querySelectorAll('body *')].filter((e) => (e.innerText || '').trim().replace(/\s+/g, ' ') === t && e.getBoundingClientRect().width > 0)
      .sort((a, b) => a.getBoundingClientRect().width - b.getBoundingClientRect().width)[0];
    if (!el) return;
    el.scrollIntoView({ block: 'start' });
    // a görgethető szülőben a fejléc alá húzzuk
    let p = el.parentElement; while (p && p.scrollHeight <= p.clientHeight + 2) p = p.parentElement;
    if (p) p.scrollTop -= tetejere; else window.scrollBy(0, -tetejere);
  }, t, tetejere);
  await sleep(1200);
}

const feladatok = {
  async onya_nyito() {
    const k = await uj(1280, 900, 2);
    await k.page.goto('https://onya.nav.gov.hu/', { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(3500); await k.page.evaluate(SUTI_EL); await sleep(500);
    await megorokit(k.page, 2, 'onya_nyito', [{ nev: 'bejelentkezes', t: 'Bejelentkezés' }, { nev: 'azonositas_nelkul', t: 'Belépés azonosítás nélkül' }], { megjegyzes: 'a süti-tájékoztató ablakot a képről eltávolítottuk (nem fogadtuk el)' });
    await k.browser.close();
  },
  async kau_belepes() {
    const k = await uj(390, 844, 3, true);
    await k.page.goto('https://ugyfelportal.nav.gov.hu/vallalkozoi-ugyseged/main', { waitUntil: 'networkidle2', timeout: 60000 });
    await sleep(4000);
    await megorokit(k.page, 3, 'kau_belepes', [{ nev: 'dap', sel: 'button.btn-primary, a.btn-primary, .dap-button, button' }, { nev: 'ugyfelkapu', t: 'Ügyfélkapu+' }, { nev: 'cim', t: 'Bejelentkezés' }], { kert_url: 'https://ugyfelportal.nav.gov.hu/vallalkozoi-ugyseged/main' });
    await k.browser.close();
  },
  async ujegyke_terkep() {
    const k = await ujegykeUrlap(1280, 900);
    await megorokit(k.page, 2, 'ujegyke_terkep', [{ nev: 'meghatalmazasok', t: 'Meghatalmazások', szulo: 0 }, { nev: 'ujegyke', t: 'UJEGYKE' }, { nev: 'kivalaszt', sel: '#nyomtatvanyterkep_list_item_button_UJEGYKE_kivalasztas' }], {});
    await k.browser.close();
  },
  async urlap_kepviselo() {
    const k = await ujegykeUrlap(1280, 1000);
    await k.page.evaluate(() => document.querySelector('#nyomtatvanyterkep_list_item_button_UJEGYKE_kivalasztas').click());
    await sleep(9000);
    await gorget(k.page, 'Képviselő', 195);
    await megorokit(k.page, 2, 'urlap_kepviselo', [
      { nev: 'kepviselo', t: 'Képviselő' }, { nev: 'maganszemely', t: 'Magánszemély' },
      { nev: 'neve_cimke', t: 'Neve' }, { nev: 'adoazon_cimke', t: 'Adóazonosító jele' },
      { nev: 'szervezet', t: 'Szervezet' }, { nev: 'nem_ismert', t: 'Magyarországon kiadott adószáma nem ismert' },
      { nev: 'kepviselet', t: 'Képviselet' }, { nev: 'kod_cimke', t: 'Kód' }, { nev: 'nyilv_cimke', t: 'Nyilvántartási szám' },
      { nev: 'kod_mezo', sel: '#input_field_0_0A0001E005A_120002_fieldgroups' },
    ], {});
    // jogcím-lista lenyitva
    const r = await k.page.evaluate(() => { const el = document.querySelector('#input_field_0_0A0001E005A_120002_fieldgroups'); const b = el.getBoundingClientRect(); return { x: b.right - 12, y: b.top + b.height / 2 }; });
    await k.page.mouse.click(r.x, r.y); await sleep(2500);
    await megorokit(k.page, 2, 'urlap_jogcim', [
      { nev: 'kod_mezo', sel: '#input_field_0_0A0001E005A_120002_fieldgroups' },
      { nev: 'opcio_9', t: '9 - Könyvelő (amennyiben nem gazdasági társaság vagy szervezet foglalkoztatottjaként, tagjaként látja el az adózó képviseletét)' },
      { nev: 'nyilv_cimke', t: 'Nyilvántartási szám' }, { nev: 'megnevezes_cimke', t: 'Megnevezés' },
    ], {});
    await k.browser.close();
  },
  async urlap_idobeli() {
    const k = await ujegykeUrlap(1280, 1000);
    await k.page.evaluate(() => document.querySelector('#nyomtatvanyterkep_list_item_button_UJEGYKE_kivalasztas').click());
    await sleep(9000);
    await valodiKatt(k.page, 'Képviseleti jogosultság időbeli hatálya, csatolmányok, elérhetőség');
    await gorget(k.page, 'Képviseleti jogosultság időbeli hatálya, csatolmányok, elérhetőség', 195);
    await megorokit(k.page, 2, 'urlap_idobeli', [
      { nev: 'fejlec', t: 'Képviseleti jogosultság időbeli hatálya, csatolmányok, elérhetőség' },
      { nev: 'megszunes', t: 'megszűnését jelentem be' },
      { nev: 'kezdete', t: 'Képviseleti jogosultság kezdete' }, { nev: 'vege', t: 'Képviseleti jogosultság vége' },
      { nev: 'csatolmany', t: 'mellékletet csatolok' }, { nev: 'bejelento', t: 'Bejelentő' },
    ], {});
    await k.browser.close();
  },
  async urlap_fo_ugycsoport() {
    const k = await ujegykeUrlap(1280, 1000);
    await k.page.evaluate(() => document.querySelector('#nyomtatvanyterkep_list_item_button_UJEGYKE_kivalasztas').click());
    await sleep(9000);
    await valodiKatt(k.page, 'Fő ügycsoportok');
    await gorget(k.page, 'Fő ügycsoportok', 195);
    await megorokit(k.page, 2, 'urlap_fo_ugycsoport', [
      { nev: 'fejlec', t: 'Fő ügycsoportok' },
      { nev: 'adougyek', t: 'ADÓÜGYEK (kivéve egyes jövedéki ügyek)' },
      { nev: 'adougyek_jogosult', t: 'Ügycsoport intézésére jogosult', utana: 'ADÓÜGYEK (kivéve egyes jövedéki ügyek)' },
      { nev: 'adougyek_irat', t: 'Több jogosult közül az iratátvételre elsődlegesen kijelölt', utana: 'ADÓÜGYEK (kivéve egyes jövedéki ügyek)' },
      { nev: 'jovedeki', t: 'JÖVEDÉKI ÜGYEK' }, { nev: 'vamugyek', t: 'VÁMÜGYEK' },
      { nev: 'fizetesi', t: 'FIZETÉSI KEDVEZMÉNYI ÉS VÉGREHAJTÁSI ÜGYEK' },
    ], {});
    await k.browser.close();
  },
  async urlap_vegyes() {
    const k = await ujegykeUrlap(1280, 1300);
    await k.page.evaluate(() => document.querySelector('#nyomtatvanyterkep_list_item_button_UJEGYKE_kivalasztas').click());
    await sleep(9000);
    await valodiKatt(k.page, 'Ügycsoportok részletezése > Vegyes ügyek');
    await gorget(k.page, 'Ügycsoportok részletezése > Vegyes ügyek', 215);
    await megorokit(k.page, 2, 'urlap_vegyes', [
      { nev: 'fejlec', t: 'Ügycsoportok részletezése > Vegyes ügyek' },
      { nev: 'femker', t: 'Fémkereskedelmi ügyek' },
      { nev: 'ev', t: 'Egyéni vállalkozói nyilvántartással kapcsolatos ügyek (kivéve adóügyek)' },
      { nev: 'ev_jogosult', t: 'Ügycsoport intézésére jogosult', utana: 'Egyéni vállalkozói nyilvántartással kapcsolatos ügyek (kivéve adóügyek)' },
      { nev: 'ev_irat', t: 'Több jogosult közül az iratátvételre elsődlegesen kijelölt', utana: 'Egyéni vállalkozói nyilvántartással kapcsolatos ügyek (kivéve adóügyek)' },
      { nev: 'nyugta', t: 'Nyugta/számla nyomdai előállításához szükséges sorszámigénylés; valamint adattörlő kód igénylése és a kapcsolódó adatszolgáltatás' },
    ], {});
    await k.browser.close();
  },
};
for (const [nev, fn] of Object.entries(feladatok)) {
  if (CSAK && !CSAK.split(',').includes(nev)) continue;
  try { await fn(); } catch (e) { console.log('HIBA', nev, String(e).slice(0, 300)); }
}
