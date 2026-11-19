#!/usr/bin/env node
// 11-19 javító kör 2 – helyi végigjátszás képekkel (a VALÓDI backend: scripts/_helyi_j2.mjs, PORT=8861). Fej nélküli
// Chrome (puppeteer-core a kod/panel-ből), minden útvonal saját --user-data-dir-rel. Kimenet: kod/_qa/j2_*.png +
// kod/_qa/j2_eredmeny.json (mérések). Jelszót nem gépelünk: a helyi szerver léptet be.
//   node scripts/_kepek_j2.mjs [útvonal-előtag …]
import { mkdirSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(app, '../panel/package.json'));
const puppeteer = require('puppeteer-core');
const chrome = process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const BASE = process.env.BASE || 'http://127.0.0.1:8861';
const ki = resolve(app, '..', '_qa');
mkdirSync(ki, { recursive: true });
const csak = process.argv.slice(2);
const mer = {};

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
  const ok = await page.evaluate((f) => {
    const cimkek = [...document.querySelectorAll('div,span,label')].filter((x) => x.childElementCount === 0 && x.textContent?.trim() === f);
    for (const c of cimkek) {
      let p = c.parentElement;
      for (let i = 0; i < 4 && p; i++, p = p.parentElement) {
        const inp = p.querySelector('input,textarea');
        if (inp) {
          inp.focus();
          inp.select?.();
          return true;
        }
      }
    }
    return false;
  }, felirat);
  if (!ok) throw new Error(`nincs mező: ${felirat}`);
  await page.keyboard.type(ertek, { delay: 25 });
  await var_(200);
}
async function mezoErtek(page, felirat) {
  return page.evaluate((f) => {
    const c = [...document.querySelectorAll('div,span,label')].find((x) => x.childElementCount === 0 && x.textContent?.trim() === f);
    let p = c?.parentElement;
    for (let i = 0; i < 4 && p; i++, p = p.parentElement) {
      const inp = p.querySelector('input,textarea');
      if (inp) return inp.value;
    }
    return null;
  }, felirat);
}
async function lo(page, nev, magas = 1) {
  const v = page.viewport();
  if (magas !== 1) await page.setViewport({ ...v, height: Math.round(v.height * magas) });
  await var_(600);
  await page.screenshot({ path: join(ki, `j2_${nev}.png`) });
  if (magas !== 1) await page.setViewport(v);
  console.log('kép:', `j2_${nev}.png`);
}
async function ut(nev, fn, meret = { width: 390, height: 844 }) {
  if (csak.length && !csak.some((c) => nev.startsWith(c))) return;
  const browser = await puppeteer.launch({ executablePath: chrome, headless: 'new', userDataDir: join(tmpdir(), `kj_j2_${nev}_${Date.now()}`), args: ['--disable-gpu', '--no-first-run', '--lang=hu-HU'] });
  try {
    const page = await browser.newPage();
    await page.setViewport({ ...meret, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await fn(page);
  } catch (e) {
    console.log(`HIBA (${nev}):`, e.message);
    mer[`${nev}_hiba`] = e.message;
  } finally {
    await browser.close();
  }
}
const uj = async (page, nev, ide = '/bekotes', allapot = '') => {
  await page.goto(`${BASE}/__helyi/uj?nev=${nev}&ide=${encodeURIComponent(ide)}${allapot ? `&allapot=${allapot}` : ''}`, { waitUntil: 'networkidle0' });
  await var_(2200);
};
const szoveg = (p) => p.evaluate(() => document.body.innerText);

// ---- A (blokkoló): új „van” ügyfél, 1 → 2 → 3. lap, EGY „Mentés” elég; az adószám nem tűnik el
await ut('a_van', async (p) => {
  const keresek = [];
  p.on('response', (r) => {
    const u = r.url();
    if (u.includes('/api/v1/client/profile') && r.request().method() !== 'GET') keresek.push(`${r.request().method()} ${u.replace(/^.*\/api\/v1/, '')} ${r.status()}`);
  });
  await uj(p, 'vanloop');
  await kattint(p, 'Igen, van');
  await var_(800);
  await p.goto(`${BASE}/bekotes/adatok`, { waitUntil: 'networkidle0' });
  await var_(1500);
  await gepel(p, 'Telefonszám', '+36 30 555 0177');
  await gepel(p, 'Adóazonosító jel', '8123456786');
  await gepel(p, 'Irányítószám', '6720');
  await gepel(p, 'Település', 'Szeged');
  await gepel(p, 'Utca, házszám', 'Minta utca 3.');
  await kattint(p, 'Tovább');
  await var_(1200);
  await gepel(p, 'Adószám', '12345676141');
  await gepel(p, 'Székhelyed települése', 'Szeged');
  await gepel(p, 'Mivel foglalkozol?', 'Grafikai tervezés');
  await kattint(p, 'Szolgáltatás, szellemi munka');
  await gepel(p, 'Mióta vagy egyéni vállalkozó?', '2024-03-01');
  await lo(p, 'a01_van_2_lap_kitoltve', 1.6);
  await kattint(p, 'Tovább');
  await var_(1500);
  await lo(p, 'a02_van_3_lap');
  // vissza a 2. lapra: az adószám megvan?
  await kattint(p, 'Vissza: Vállalkozásod');
  await var_(1200);
  mer.a_adoszam_vissza_utan = await mezoErtek(p, 'Adószám');
  await lo(p, 'a03_van_2_lap_vissza_adoszam_megvan');
  await kattint(p, 'Tovább');
  await var_(1500);
  await kattint(p, 'Nem, ez a fő munkám');
  await kattint(p, 'Igen, van');
  await kattint(p, 'Mentés');
  await var_(2500);
  mer.a_url_mentes_utan = p.url();
  mer.a_profil_keresek = keresek;
  mer.a_hiba_latszik = /nem stimmel/.test(await szoveg(p));
  await lo(p, 'a04_mentes_utan_fooldal', 2);
});

// ---- B: most indítja, a kérdőív kész, a tevékenység-sor készül: a Főoldal sora + a központ
await ut('b_kerdoiv', async (p) => {
  await uj(p, 'kerdoiv', '/bekotes', 'inditas_kerdoiv');
  await lo(p, 'b01_fooldal_kerdoiv_utan_390', 2.6);
  mer.b_fooldal = (await szoveg(p)).split('\n').filter((x) => /Bejelentés a NAV-nál|tevékenység-sorodat|Útmutató|Átnézzük|Adószámod/.test(x)).slice(0, 8);
  await p.goto(`${BASE}/bekotes/vallalkozas`, { waitUntil: 'networkidle0' });
  await var_(1500);
  await lo(p, 'b02_kozpont_390', 1.5);
  mer.b_kozpont = (await szoveg(p)).split('\n').filter((x) => /útmutató/i.test(x)).slice(0, 5);
});

// ---- C: a megválaszolatlan kérdés alatti előnézet + az új sor
await ut('c_elonezet', async (p) => {
  await uj(p, 'elonezet');
  await lo(p, 'c01_fooldal_elonezet_390', 2.2);
});

// ---- D: 320×640, bekötés közben: rövid sáv, a „Most ez jön” gombja a fülsor fölött
await ut('d_320', async (p) => {
  await uj(p, 'kicsi', '/bekotes', 'inditas_kerdoiv');
  await lo(p, 'd01_fooldal_320');
}, { width: 320, height: 640 });
await ut('d_320b', async (p) => {
  await uj(p, 'kicsib');
  await kattint(p, 'Még nincs, most indítanám');
  await var_(1200);
  await kattint(p, 'Bezár');
  await var_(1200);
  await lo(p, 'd02_fooldal_inditas_kiemelt_320');
}, { width: 320, height: 640 });

// ---- E: 390 – a „Hogyan jelentsük be?” lap bezárása után a kiemelt kártya (oszlopos elrendezés 400 pt alatt)
await ut('e_kiemelt', async (p) => {
  await uj(p, 'kiemelt');
  await kattint(p, 'Még nincs, most indítanám');
  await var_(1200);
  await lo(p, 'e01_mod_lap_onya_390');
  await kattint(p, 'Bezár');
  await var_(1200);
  await lo(p, 'e02_fooldal_kiemelt_390');
});

// ---- F: „Intézzétek helyettem” – mentett szám nélkül a számmező és a küldés gomb a lap tetején
await ut('f_helyettem', async (p) => {
  await uj(p, 'helyettem');
  await p.goto(`${BASE}/helyettunk?fajta=vallalkozas_bejelentes`, { waitUntil: 'networkidle0' });
  await var_(1500);
  await lo(p, 'f01_keres_lap_teteje_390');
  mer.f_szammezo_y = await p.evaluate(() => {
    const c = [...document.querySelectorAll('div,span')].find((x) => x.childElementCount === 0 && x.textContent?.trim() === 'Ezen a számon hívjunk');
    return c ? Math.round(c.getBoundingClientRect().top) : null;
  });
});

// ---- G: a kolléga hívta, nem vette fel – a Főoldal és a központ is ezt mondja
await ut('g_nemvette', async (p) => {
  await uj(p, 'nemvette', '/bekotes', 'segitett_nemvette');
  await lo(p, 'g01_fooldal_nem_ertuk_el_390');
  mer.g_fooldal = (await szoveg(p)).split('\n').filter((x) => /kerestünk|hív/i.test(x)).slice(0, 4);
  await p.goto(`${BASE}/bekotes/vallalkozas`, { waitUntil: 'networkidle0' });
  await var_(1500);
  await lo(p, 'g02_kozpont_nem_ertuk_el_390');
});

// ---- H: útmutató-lépés: csak az első kép, a második egy koppintásra; a lépés magassága
await ut('h_lepes', async (p) => {
  await uj(p, 'lepes', '/bekotes', 'inditas_kerdoiv');
  const m = {};
  for (const n of [4, 5, 8, 10]) {
    await p.goto(`${BASE}/bekotes/vallalkozas/utmutato?lepes=${n}`, { waitUntil: 'networkidle0' });
    await var_(1800);
    m[n] = await p.evaluate(() => {
      const g = [...document.querySelectorAll('div')].filter((d) => d.scrollHeight > d.clientHeight + 4).sort((a, b) => b.scrollHeight - a.scrollHeight)[0];
      return g ? Math.round((g.scrollHeight / window.innerHeight) * 100) / 100 : null;
    });
    if (n === 8) await lo(p, 'h01_lepes8_390', 2.2);
  }
  mer.h_kepernyo_390 = m;
});
await ut('h_320', async (p) => {
  await uj(p, 'lepes320', '/bekotes', 'inditas_kerdoiv');
  await p.goto(`${BASE}/bekotes/vallalkozas/utmutato?lepes=9`, { waitUntil: 'networkidle0' });
  await var_(1800);
  await lo(p, 'h02_lepes9_320', 1.8);
  await kattint(p, 'Nagyítom');
  await var_(800);
  await kattint(p, 'Nagyobb');
  await kattint(p, 'Nagyobb');
  await kattint(p, 'Nagyobb');
  await lo(p, 'h03_nagyito_320');
}, { width: 320, height: 640 });

// ---- I: meglévő vállalkozás, a meghatalmazás jön: semleges gombfelirat a Főoldalon
await ut('i_mh', async (p) => {
  await uj(p, 'mh', '/bekotes', 'mh');
  await lo(p, 'i01_fooldal_mh_390', 1.5);
});

writeFileSync(join(ki, 'j2_eredmeny.json'), JSON.stringify(mer, null, 1));
console.log(JSON.stringify(mer, null, 1));
