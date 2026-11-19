#!/usr/bin/env node
// 11-19 javító kör – helyi végigjátszás képekkel (a VALÓDI backend, scripts/_helyi_j1119.mjs, PORT=8851). Fej nélküli
// Chrome (puppeteer-core a kod/panel-ből), minden útvonal saját --user-data-dir-rel. Kimenet: kod/_qa/j1119_*.png.
//   node scripts/_kepek_j1119.mjs [útvonal-előtag …]
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(app, '../panel/package.json'));
const puppeteer = require('puppeteer-core');
const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE || 'http://127.0.0.1:8851';
const ki = resolve(app, '..', '_qa');
mkdirSync(ki, { recursive: true });
const csak = process.argv.slice(2);
const merések = {};

const var_ = (ms) => new Promise((r) => setTimeout(r, ms));
async function kattint(page, szoveg, n = 0) {
  const elemek = await page.$$(`::-p-text(${JSON.stringify(szoveg)})`);
  if (!elemek.length) throw new Error(`nincs ilyen szöveg: ${szoveg}`);
  const e = elemek[Math.min(n, elemek.length - 1)];
  await e.evaluate((x) => x.scrollIntoView({ block: 'center' }));
  await var_(300);
  await e.click();
  await var_(1100);
}
async function gepel(page, felirat, ertek) {
  // a Mezo komponens: <label> szöveg, alatta input; a felirat szövegéhez legközelebbi input
  const ok = await page.evaluate((f, v) => {
    const cimkek = [...document.querySelectorAll('div,span,label')].filter((x) => x.childElementCount === 0 && x.textContent?.trim() === f);
    for (const c of cimkek) {
      let p = c.parentElement;
      for (let i = 0; i < 4 && p; i++, p = p.parentElement) {
        const inp = p.querySelector('input,textarea');
        if (inp) {
          inp.focus();
          return true;
        }
      }
    }
    return false;
  }, felirat, ertek);
  if (!ok) throw new Error(`nincs mező: ${felirat}`);
  await page.keyboard.type(ertek, { delay: 5 });
  await var_(150);
}
async function gorgetes(page) {
  return page.evaluate(() => Math.max(0, ...[...document.querySelectorAll('div')].map((d) => (d.scrollHeight > d.clientHeight + 4 ? d.scrollTop : 0))));
}
async function lo(page, nev, magas = 1) {
  const v = page.viewport();
  if (magas !== 1) await page.setViewport({ ...v, height: Math.round(v.height * magas) });
  await var_(500);
  await page.screenshot({ path: join(ki, `j1119_${nev}.png`) });
  if (magas !== 1) await page.setViewport(v);
  console.log('kép:', `j1119_${nev}.png`);
}

async function ut(nev, fn, meret = { width: 390, height: 844 }) {
  if (csak.length && !csak.some((c) => nev.startsWith(c))) return;
  const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new', userDataDir: join(tmpdir(), `kj_j1119_${nev}_${Date.now()}`), args: ['--disable-gpu', '--no-first-run', '--lang=hu-HU'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ ...meret, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await fn(page);
  } catch (e) {
    console.log(`HIBA (${nev}):`, e.message);
  } finally {
    await browser.close();
  }
}
const belep = async (page, ki_, ide = '/bekotes') => {
  await page.goto(`${BASE}/__helyi/belep?ki=${ki_}&ide=${encodeURIComponent(ide)}`, { waitUntil: 'networkidle0' });
  await var_(1800);
};
const uj = async (page, nev, ide = '/bekotes') => {
  await page.goto(`${BASE}/__helyi/uj?nev=${nev}&ide=${encodeURIComponent(ide)}`, { waitUntil: 'networkidle0' });
  await var_(2000);
};

// ---- 1. + 2. hiba: van-adatlap piszkozat, útváltás, vissza; 6.: a jelzés a lap fölött; 7.: 320×640 Főoldal
await ut('a_valtas', async (p) => {
  await uj(p, 'valto');
  await lo(p, 'a01_fooldal_kerdes_390');
  await kattint(p, 'Igen, van');
  await var_(800);
  await p.goto(`${BASE}/bekotes/adatok`, { waitUntil: 'networkidle0' });
  await var_(1500);
  await gepel(p, 'Telefonszám', '+36 30 555 0177');
  await gepel(p, 'Adóazonosító jel', '8123456786');
  await gepel(p, 'Irányítószám', '6720');
  await gepel(p, 'Település', 'Szeged');
  await gepel(p, 'Utca, házszám', 'Minta utca 3.');
  await lo(p, 'a02_van_adatlap_1_lap', 1.4);
  await kattint(p, 'Tovább');
  await var_(800);
  await lo(p, 'a03_van_adatlap_2_lap');
  await kattint(p, 'Még nincs adószámom – most indítanám');
  await var_(900);
  await lo(p, 'a04_valtas_lap');
  await kattint(p, 'Igen, még nincs vállalkozásom');
  await var_(1200);
  await lo(p, 'a05_mod_lap_jelzes_fent');
  await kattint(p, 'Ezt választom');
  await var_(1500);
  await lo(p, 'a06_utana');
  await p.goto(`${BASE}/bekotes`, { waitUntil: 'networkidle0' });
  await var_(1500);
  await lo(p, 'a07_fooldal_utvaltas_utan', 2.4);
  merések.a_profil = await p.evaluate(async () => (await fetch('/api/v1/client/profile', { credentials: 'include' }).then((r) => (r.ok ? r.json() : r.status)).catch(() => 'hiba')));
});
await ut('b_320', async (p) => {
  await uj(p, 'kicsi');
  await lo(p, 'b01_fooldal_kerdes_320');
}, { width: 320, height: 640 });
await ut('b_320m', async (p) => {
  await belep(p, 'marika');
  await lo(p, 'b02_marika_fooldal_320');
}, { width: 320, height: 640 });
await ut('b_320s', async (p) => {
  await uj(p, 'kicsi2');
  await kattint(p, 'Még nincs, most indítanám');
  await var_(1000);
  await lo(p, 'b03_mod_lap_320');
}, { width: 320, height: 640 });

// ---- 3. hiba: lépésváltás után a görgetés a tetején; 20.: kiemelt csík a magam-útmutatóban
/** A böngésző saját sütijével API-hívások (állapot-előkészítés a képekhez; jelszót nem gépelünk). */
async function api(p, hivasok) {
  return p.evaluate(async (hv) => {
    const tok = (await (await fetch('/api/v1/auth/refresh', { method: 'POST', credentials: 'include', headers: { 'content-type': 'application/json' }, body: '{}' })).json()).accessToken;
    const ki = [];
    for (const [m, u, b] of hv) {
      let body = b;
      if (b === 'CONSENTS') {
        const items = [];
        for (const d of ['aszf', 'adatkezeles', 'megbizasi_szerzodes']) items.push({ docType: d, version: (await (await fetch(`/api/v1/legal/${d}`)).json()).version });
        body = { items };
      }
      const r = await fetch(`/api/v1${u}`, { method: m, credentials: 'include', headers: { 'content-type': 'application/json', authorization: `Bearer ${tok}` }, body: body ? JSON.stringify(body) : undefined });
      ki.push(r.status);
    }
    return ki;
  }, hivasok);
}
const VAN = { firstName: 'Péter', lastName: 'Próba', phone: '+36301234567', adoazonositoJel: '8123456786', adoszam: '12345676-1-41', address: { zip: '6720', city: 'Szeged', line: 'Minta utca 3.' }, hqMunicipality: 'Szeged', activityText: 'Grafika', activityAnswer: 'egyeb', taxStatus: 'fofoglalkozasu', evSince: '2024-03-01', hasSeparateBusinessAccount: true };

await ut('c_gorgetes', async (p) => {
  await p.goto(`${BASE}/__helyi/uj?nev=gorget&allapot=mh&ide=${encodeURIComponent('/bekotes/meghatalmazas?mod=magam&lepes=0')}`, { waitUntil: 'networkidle0' });
  await var_(2500);
  await lo(p, 'c01_mh_magam_bevezeto', 1.5);
  await kattint(p, 'Kezdjük');
  await var_(800);
  merések.c_lepes1 = await gorgetes(p);
  await kattint(p, 'Megvan, tovább');
  await var_(900);
  merések.c_lepes2 = await gorgetes(p);
  await lo(p, 'c02_mh_lepes2_tovabb_utan');
  await kattint(p, 'Megvan, tovább');
  await var_(900);
  merések.c_lepes3 = await gorgetes(p);
  await lo(p, 'c03_mh_lepes3_tovabb_utan');
  await lo(p, 'c04_mh_lepes3_teljes', 2.4);
});

// ---- 5. + 30. hiba: Dávid (van, a meghatalmazást intézzük) – egyszer az állapot, a saját „Így megy”
await ut('d_david', async (p) => {
  await belep(p, 'david', '/bekotes/meghatalmazas');
  await lo(p, 'd01_david_meghatalmazas', 2.2);
  await p.goto(`${BASE}/bekotes`, { waitUntil: 'networkidle0' });
  await var_(1500);
  await lo(p, 'd02_david_fooldal', 2.4);
});

// ---- 19. hiba: a jóváhagyás útmutatója – minden ONYA-lépésnek van képe
await ut('e_jovahagyas', async (p) => {
  await belep(p, 'marika', '/bekotes/meghatalmazas/jovahagyas?lepes=3');
  await lo(p, 'e01_jovahagyas_lepes3', 1.6);
  await p.goto(`${BASE}/bekotes/meghatalmazas/jovahagyas?lepes=4`, { waitUntil: 'networkidle0' });
  await var_(1500);
  await lo(p, 'e02_jovahagyas_lepes4', 1.8);
  await p.goto(`${BASE}/bekotes/meghatalmazas/jovahagyas?lepes=5`, { waitUntil: 'networkidle0' });
  await var_(1500);
  await lo(p, 'e03_jovahagyas_lepes5', 2.0);
  await p.goto(`${BASE}/bekotes/meghatalmazas/jovahagyas?lepes=6`, { waitUntil: 'networkidle0' });
  await var_(1500);
  await lo(p, 'e04_jovahagyas_lepes6', 1.3);
});

// ---- 29. + 24. hiba: a kérés képernyője (fő gomb elöl, megjegyzés-tipp) és az EV-útmutató kiemelt csíkja
await ut('f_keres', async (p) => {
  await uj(p, 'keres');
  await kattint(p, 'Még nincs, most indítanám');
  await var_(800);
  await lo(p, 'f01_mod_lap_390');
  await kattint(p, 'Ezt kérem', 99);
  await var_(1500);
  await lo(p, 'f02_helyettunk_keres_teteje');
  await lo(p, 'f03_helyettunk_keres_teljes', 3.4);
});

writeFileSync(join(ki, 'j1119_meresek.json'), JSON.stringify(merések, null, 1));
console.log('mérések:', JSON.stringify(merések));
