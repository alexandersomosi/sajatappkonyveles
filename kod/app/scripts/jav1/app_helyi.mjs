// Round-1 fixer: logged-in journeys of the client app on the LOCAL harness (127.0.0.1:8841, real backend, demo seed).
// Test accounts only; passwords are read from the harness and typed only into our own local app, never printed.
//   node app_helyi.mjs [scenario …]
import { mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const puppeteer = createRequire('C:/Users/UpgradePC/konyvelo_app/kod/panel/package.json')('puppeteer-core');
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const B = process.env.BASE || 'http://127.0.0.1:8841';
const ki = process.env.KI || 'C:/Users/UpgradePC/konyvelo_app/kod/app/_kepek';
const ELO = process.env.ELO || 'jav1_h_';
mkdirSync(ki, { recursive: true });
const var_ = (ms) => new Promise((r) => setTimeout(r, ms));
const eredmeny = [];
const ell = (nev, ok, reszlet = '') => { eredmeny.push({ nev, ok: !!ok }); console.log(`${ok ? 'OK  ' : 'HIBA'} ${nev}${reszlet ? ` – ${reszlet}` : ''}`); };
const api = async (kiNev, p, m = 'GET', b) => {
  const u = new URL(B + '/__helyi/api');
  u.searchParams.set('ki', kiNev); u.searchParams.set('m', m); u.searchParams.set('p', p);
  if (b) u.searchParams.set('b', JSON.stringify(b));
  const r = await fetch(u);
  const t = await r.text();
  try { return { s: r.status, j: JSON.parse(t) }; } catch { return { s: r.status, j: t }; }
};
async function szoveg(page, t, { n = 0, ms = 12000 } = {}) {
  const sel = `::-p-text(${JSON.stringify(t)})`;
  const vege = Date.now() + ms;
  for (;;) {
    const e = await page.$$(sel);
    if (e.length > n) return e[n];
    if (Date.now() > vege) throw new Error(`nincs ilyen szöveg: ${t}`);
    await var_(250);
  }
}
const van = async (page, t, ms = 4000) => szoveg(page, t, { ms }).then(() => true).catch(() => false);
async function katt(page, t, o = {}) {
  const e = await szoveg(page, t, o);
  await e.evaluate((x) => x.scrollIntoView({ block: 'center' }));
  await e.click();
  await var_(o.utana ?? 900);
}
async function gepel(page, felirat, t) {
  const sel = `input[aria-label="${felirat}"], textarea[aria-label="${felirat}"]`;
  const vege = Date.now() + 10000;
  let e;
  while (!(e = await page.$(sel))) { if (Date.now() > vege) throw new Error(`nincs ilyen mező: ${felirat}`); await var_(250); }
  await e.evaluate((x) => x.scrollIntoView({ block: 'center' }));
  await e.click();
  await page.keyboard.down('Control');
  await page.keyboard.press('a');
  await page.keyboard.up('Control');
  await page.keyboard.press('Backspace');
  await e.type(t, { delay: 20 });
  await var_(250);
}
async function bongeszo(nev, fn, { szel = 390, mag = 844 } = {}) {
  const prof = join(tmpdir(), `kj_jav1_h_${process.pid}_${nev}_${Date.now()}`).replace(/\\/g, '/');
  const b = await puppeteer.launch({ executablePath: chrome, headless: true, userDataDir: prof, args: ['--no-first-run', '--no-default-browser-check', '--mute-audio', '--hide-scrollbars'] });
  try {
    const page = await b.newPage();
    const hibak = [];
    page.on('pageerror', (e) => hibak.push(e.message));
    await page.setViewport({ width: szel, height: mag, deviceScaleFactor: 2 });
    const kep = async (n, teljes = false) => { await var_(500); await page.screenshot({ path: `${ki}/${ELO}${n}.png`, fullPage: teljes }); };
    const megy = async (ut, be) => {
      const cel = `${ut}${ut.includes('?') ? '&' : '?'}szelesseg=${szel}`;
      await page.goto(`${B}${be ? `${be}&ide=${encodeURIComponent(cel)}` : cel}`, { waitUntil: 'networkidle0', timeout: 60000 });
      await var_(1500);
    };
    await fn(page, { kep, megy });
    if (hibak.length) ell(`${nev}: nincs oldalhiba`, false, hibak.join(' | ').slice(0, 300));
  } catch (e) {
    ell(nev, false, e.message);
    try { await (await b.pages()).at(-1)?.screenshot({ path: `${ki}/${ELO}${nev}_HIBA.png` }); } catch {}
  } finally {
    await b.close();
    try { rmSync(prof, { recursive: true, force: true }); } catch {}
  }
}

const S = {
  // ---- new business: the short "Rólad" page comes BEFORE the hub/data sheet, nobody hits the dead end at the end ----
  async uj() {
    const email = `panna.${Date.now() % 100000}@pelda.test`;
    await bongeszo('uj', async (page, { kep, megy }) => {
      await megy('/bekotes', `/__helyi/uj?email=${encodeURIComponent(email)}&vezetek=Pr%C3%B3ba&kereszt=Panna`);
      ell('új ügyfél: a kérdés látszik', await van(page, 'Van már egyéni vállalkozásod?'));
      await kep('uj_01_bekotes');
      await katt(page, 'Még nincs, most indítanám', { utana: 2500 });
      ell('„Még nincs” után a Rólad lapra visz', page.url().includes('/bekotes/adatok'), page.url());
      ell('a Rólad lap egy lapos (nincs „1. lap a 3-ból”)', !(await van(page, 'lap a 3-ból', 1500)));
      await kep('uj_02_rolad');
      await gepel(page, 'Telefonszám', '+36301234567');
      await gepel(page, 'Adóazonosító jel', '8417104569');
      await gepel(page, 'Irányítószám', '6720');
      await gepel(page, 'Település', 'Szeged');
      await gepel(page, 'Utca, házszám', 'Példa utca 7.');
      await katt(page, 'Mentem, tovább', { utana: 3000 });
      ell('mentés után a vállalkozás-központba visz', /\/bekotes\/vallalkozas(\?|$)/.test(page.url()), page.url());
      ell('a központ az adatlapot kínálja (nem az adatokat)', await van(page, 'Kitöltöm az adatlapot'));
      await kep('uj_03_kozpont', true);
      await katt(page, 'Kitöltöm az adatlapot', { utana: 2500 });
      ell('az adatlap megnyílik (1/5)', await van(page, 'Mielőtt elkezded'));
      // page 3: "A lakcímem" carries the saved address
      await megy('/bekotes/vallalkozas/adatlap?lap=3');
      ell('székhely: a lakcím a mentett címmel választható', await van(page, '6720 Szeged, Példa utca 7.'));
      await kep('uj_04_adatlap_3', true);
    });
    // a second fresh client goes straight to the data sheet without "Rólad": the gate, not a dead end at page 5
    const email2 = `kapu.${Date.now() % 100000}@pelda.test`;
    await bongeszo('kapu', async (page, { kep, megy }) => {
      await megy('/bekotes', `/__helyi/uj?email=${encodeURIComponent(email2)}&vezetek=Kapu&kereszt=Kinga`);
      const r = await api(email2, '/client/onboarding/business-status', 'PUT', { businessStatus: 'inditas' });
      ell('API: indítás út beállítva', r.s === 200, String(r.s));
      await megy('/bekotes/vallalkozas/adatlap?lap=5');
      ell('adatlap „Rólad” nélkül: a kapu jelenik meg', await van(page, 'Előbb pár adat rólad'));
      await kep('kapu_01_adatlap');
      await megy('/bekotes/vallalkozas');
      ell('központ „Rólad” nélkül: „Megadom az adataimat”', await van(page, 'Megadom az adataimat'));
      await kep('kapu_02_kozpont', true);
      await katt(page, 'Megadom az adataimat', { utana: 2500 });
      ell('a gomb a Rólad lapra visz', page.url().includes('/bekotes/adatok') && page.url().includes('utana=adatlap'), page.url());
    });
  },

  // ---- 2FA more than 10 minutes after signing in: the password field appears and the request goes again ----
  async ketlepcsos() {
    await bongeszo('2fa', async (page, { kep, megy }) => {
      await megy('/fiok/ketlepcsos', '/__helyi/belep?ki=kata');
      await fetch(`${B}/__helyi/ido?perc=16`);
      await katt(page, 'Bekapcsolom', { utana: 2500 });
      const mezo = await page.$('input[aria-label="Mostani jelszó"]');
      ell('régi belépésnél megjelenik a „Mostani jelszó” mező', !!mezo);
      await kep('2fa_01_jelszo_kell');
      // wrong password first: the field shows the server's message
      await gepel(page, 'Mostani jelszó', 'nem-ez-a-jelszo');
      await katt(page, 'Bekapcsolom', { utana: 2500 });
      ell('rossz jelszó: a mező alatt a hiba', await van(page, 'Ez nem a mostani jelszavad.'));
      await kep('2fa_02_rossz_jelszo');
      const pw = await (await fetch(`${B}/__helyi/jelszo?ki=kata`)).text();
      await gepel(page, 'Mostani jelszó', pw);
      await katt(page, 'Bekapcsolom', { utana: 3000 });
      ell('jó jelszóval megjön a kulcs (1. Add hozzá…)', await van(page, 'Add hozzá a hitelesítő appodhoz'));
      await page.evaluate(() => { const i = document.querySelector('input[aria-label="Mostani jelszó"]'); if (i) i.value = ''; });
      await kep('2fa_03_kulcs');
    });
    await fetch(`${B}/__helyi/ido?perc=-16`);
  },

  // ---- approved with a manual override → partial payment → the account-numbers sheet ----
  async fizetes() {
    const cl = await api('bence', '/acc/clients?filter=mind');
    const kata = cl.j.items.find((c) => c.name.includes('Kata'));
    const tp = await api('bence', `/acc/clients/${kata.id}/tax-periods?year=2026`);
    const q4 = tp.j.items.find((p) => p.periodKey === '2026-Q4');
    if (q4.calcStatus !== 'jovahagyva') {
      const r = q4.latestCalculation.result.quarter ?? q4.latestCalculation.result;
      const a = await api('bence', `/acc/tax-calculations/${q4.latestCalculation.id}/approve`, 'POST', {
        letterText: 'Az eddigi bevételeid alapján kiszámoltam, mennyit kell most befizetned.',
        overrides: { tbHuf: r.tbHuf, szochoHuf: r.szochoHuf, szjaAdvanceHuf: 80000, reason: 'decemberi táppénz, kieső napok' },
      });
      ell('API: Kata IV. negyedéve jóváhagyva kézi módosítással', a.s === 200, `${a.s} ${JSON.stringify(a.j).slice(0, 200)}`);
    }
    await bongeszo('fiz', async (page, { kep, megy }) => {
      await megy('/', '/__helyi/belep?ki=kata');
      ell('főoldal: a jóváhagyott összeg látszik', await van(page, 'Számlaszámok'));
      const m = await page.evaluate(() => {
        const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        let n; const r = {};
        while ((n = w.nextNode())) for (const t of ['Határidők', 'Kérdésed van?', 'külön utalás']) if (n.textContent.includes(t) && !r[t]) { const b = n.parentElement.getBoundingClientRect(); r[t] = [Math.round(b.top), Math.round(b.bottom)]; }
        return r;
      });
      console.log('   mérés (pt):', JSON.stringify(m));
      ell('gyorsműveletek a fülsor fölött (felirat alja ≤ 703 pt = a lap alja ≤ 713, + 29 pt állapotsávval ≤ 742)', m['Határidők'] && m['Határidők'][1] <= 703, JSON.stringify(m['Határidők']));
      ell('a fejléc egy sor („3 külön utalás…”)', m['külön utalás'] && m['külön utalás'][1] - m['külön utalás'][0] <= 26, JSON.stringify(m['külön utalás']));
      await kep('fiz_01_fooldal');
      await katt(page, 'Hogyan jött ki?', { utana: 1500 });
      ell('„Hogyan jött ki?”: a módosítás oka és az áthúzott összeg', (await van(page, 'kézzel módosította az összeget')) && (await van(page, 'A könyvelőd módosította.')));
      await kep('fiz_02_hogyan');
      await page.evaluate(() => { const s = [...document.querySelectorAll('div')].filter((d) => d.scrollHeight > d.clientHeight + 40 && getComputedStyle(d).overflowY !== 'visible'); s.forEach((d) => (d.scrollTop = d.scrollHeight)); });
      await kep('fiz_03_hogyan_alja');
    });
    // partial payment: TB and szocho marked paid, SZJA still open
    const home = await api('kata', '/client/home');
    const pid = home.j.hero.periodId;
    if (home.j.paymentItems.every((x) => !x.markedPaidAt)) {
      const r = await api('kata', `/client/tax-periods/${pid}/mark-paid`, 'POST', { paidOn: '2026-11-17', kinds: ['tb_jarulek', 'szocho'] });
      ell('API: TB és szocho befizetettnek jelölve', r.s === 200, String(r.s));
    }
    await bongeszo('fiz2', async (page, { kep, megy }) => {
      await megy('/?lap=szamlaszamok', '/__helyi/belep?ki=kata');
      ell('részben fizetve: „Már csak egy utalás van hátra”', await van(page, 'Már csak egy utalás van hátra'));
      ell('a befizetett tétel jelölve: „Ezt már befizetted, ne utald el újra”', await van(page, 'Ezt már befizetted, ne utald el újra'));
      const db = await page.evaluate(() => [...document.querySelectorAll('[role=button]')].filter((b) => b.textContent.trim() === 'Kimásolom').length);
      ell('másoló gomb csak a hátralévő tételnél van (3 db)', db === 3, String(db));
      await kep('fiz_04_szamlaszamok_reszben', true);
      // clipboard write refused → no "Kimásoltad"
      await page.evaluate(() => { Object.defineProperty(navigator, 'clipboard', { value: { writeText: () => Promise.reject(new Error('tiltva')) }, configurable: true }); document.execCommand = () => false; });
      await katt(page, 'Kimásolom', { utana: 700 });
      ell('sikertelen másolásnál nincs „Kimásoltad”, hanem a kézi másolás üzenete', (await van(page, 'Nem sikerült kimásolni', 2500)) && !(await van(page, 'Kimásoltad:', 800)));
      await kep('fiz_05_masolas_hiba');
    });
  },

  // ---- subscription without a saved card ----
  async kartya() {
    const d = await api('kata', '/client/subscription/card/delete', 'POST', {});
    ell('API: kártya törölve', d.s === 200, String(d.s));
    await bongeszo('kartya', async (page, { kep, megy }) => {
      await megy('/fiok/elofizetes', '/__helyi/belep?ki=kata');
      ell('kártya nélkül: figyelmeztetés + „Kártya megadása”', (await van(page, 'Nincs mentett kártyád.')) && (await van(page, 'Kártya megadása')) && !(await van(page, 'Következő levonás', 800)));
      await kep('kartya_01_nincs', true);
    });
  },

  // ---- dates and misc ----
  async vegyes() {
    await bongeszo('vegyes', async (page, { kep, megy }) => {
      await megy('/', '/__helyi/belep?ki=reka');
      await kep('reka_01_fooldal', true);
      const lejart = await page.evaluate(() => document.body.innerText.match(/A határidő [^.]*volt[^.]*\./g));
      console.log('   lejárt mondatok:', JSON.stringify(lejart));
      ell('lejárt határidő raggal („…-e volt” / „…-a volt”)', !lejart || lejart.every((s) => /\d+-⁠?(e|a|je) volt/.test(s)), JSON.stringify(lejart));
      await megy('/hataridok');
      const cimek = await page.evaluate(() => [...document.querySelectorAll('[role=heading]')].map((h) => h.textContent));
      console.log('   határidő-hónapok:', JSON.stringify(cimek));
      ell('más évi hónapcím magyar sorrendben', cimek.every((c) => !/^[A-ZÁÉÍÓÖŐÚÜŰ][a-záéíóöőúüű]+ \d{4}$/.test(c)), JSON.stringify(cimek));
      await kep('reka_02_hataridok', true);
      await megy('/uzenetek');
      await kep('reka_03_uzenetek');
    });
    await bongeszo('vegyes320', async (page, { kep, megy }) => {
      await megy('/bekotes', '/__helyi/belep?ki=levente');
      await kep('levente_320_bekotes');
      const csonka = await page.evaluate(() => [...document.querySelectorAll('div[dir=auto], span')].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).textOverflow === 'ellipsis' && e.textContent.length < 60).map((e) => e.textContent));
      ell('320 pt: a bekötés-főoldalon nincs levágott szöveg', csonka.length === 0, JSON.stringify(csonka));
      await megy('/uzenetek');
      const csonka2 = await page.evaluate(() => [...document.querySelectorAll('div[dir=auto], span')].filter((e) => e.scrollWidth > e.clientWidth + 1 && getComputedStyle(e).textOverflow === 'ellipsis' && e.textContent.length < 60).map((e) => e.textContent));
      ell('320 pt: az Üzenetek fejlécében nincs levágott szöveg', csonka2.length === 0, JSON.stringify(csonka2));
      await kep('levente_320_uzenetek');
      await megy('/bekotes/vallalkozas/utmutato');
      await kep('levente_320_utmutato', true);
    }, { szel: 320, mag: 640 });
  },
};

const kell = process.argv.slice(2);
for (const [n, f] of Object.entries(S)) {
  if (kell.length && !kell.includes(n)) continue;
  console.log(`--- ${n} ---`);
  try { await f(); } catch (e) { ell(n, false, e.message); }
}
const rossz = eredmeny.filter((e) => !e.ok);
console.log(`\n${eredmeny.length - rossz.length}/${eredmeny.length} ellenőrzés rendben${rossz.length ? `; HIBÁS: ${rossz.map((r) => r.nev).join(' | ')}` : ''}`);
