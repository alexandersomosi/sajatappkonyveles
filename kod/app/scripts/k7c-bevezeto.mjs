#!/usr/bin/env node
// k7c (tulaj 11-20: „Nem úgy volt, hogy így végigmegy először, ilyen bevezetősen?”) – the guided first run through the
// REAL registration screens, on the local harness (scripts/jav1/harness.mjs: real backend in DEMO mode, PGlite, fake data):
//   A) Regisztrálok → e-mail code (read from the harness's demo_outbox) → Megerősítem → MUST land on W1 (/bevezeto/udv),
//      W1 → W2 → W3 → Kezdjük → the branch question; "Később folytatom" → the checklist with "Folytasd ott…"
//   B) a second real sign-up whose guided run was never started, opened on /bekotes → the start card ("Kezdjük"), not
//      "Folytasd ott, ahol abbahagytad"; "Kezdjük" → W1
//   C) the allowance gate's "Később" in the guided run → the NEXT step (before: the same gate again)
//   D) the meghatalmazás step → "Ezt kérem" keeps the guided header (no tab bar) → "Kérem a visszahívást" → the guided
//      run goes on → the done screen agrees with the bar (no "Kész vagy" next to 7 / 8)
// Screenshots → kod/_qa/k7c_bevezeto_*.png (390 × 844 @2x). Every check prints OK/HIBA; exit code 1 on any HIBA.
//   APP_PORT=8871 PANEL_PORT=8872 node scripts/jav1/harness.mjs      (separate window; app export:web + backend build first)
//   BASE=http://127.0.0.1:8871 node scripts/k7c-bevezeto.mjs
import { mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';

const app = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const require = createRequire(join(app, '../panel/package.json'));
const puppeteer = require('puppeteer-core');
const BASE = process.env.BASE || 'http://127.0.0.1:8871';
const ki = resolve(app, '..', '_qa');
mkdirSync(ki, { recursive: true });
const var_ = (ms) => new Promise((r) => setTimeout(r, ms));
const futasId = Date.now().toString(36);
let hibaDb = 0;
const ellenoriz = (ok, mit) => {
  if (!ok) hibaDb++;
  console.log(`${ok ? 'OK  ' : 'HIBA'} ${mit}`);
};

async function sql(q) {
  const r = await fetch(`${BASE}/__helyi/sql?q=${encodeURIComponent(q)}`);
  if (!r.ok) throw new Error(`sql ${r.status}: ${await r.text()}`);
  return r.json();
}
const utvonal = (page) => {
  const u = new URL(page.url());
  return u.pathname + u.search;
};
async function kattint(page, szoveg, { utolso = false } = {}) {
  await page.waitForSelector(`::-p-text(${JSON.stringify(szoveg)})`, { timeout: 20_000 });
  // exact text first ("Később" must not hit "Később folytatom", "Kezdjük" not "Kezdjük egy kérdéssel.")
  const mind = await page.$$(`::-p-text(${JSON.stringify(szoveg)})`);
  const pontos = [];
  for (const x of mind) if ((await x.evaluate((n) => n.innerText?.trim())) === szoveg) pontos.push(x);
  const jeloltek = pontos.length ? pontos : mind;
  const e = utolso ? jeloltek[jeloltek.length - 1] : jeloltek[0];
  await e.evaluate((x) => x.scrollIntoView({ block: 'center' }));
  await var_(250);
  await e.click();
  await var_(1500);
}
async function ir(page, cimke, szoveg) {
  const e = await page.waitForSelector(`input[aria-label=${JSON.stringify(cimke)}]`, { timeout: 20_000 });
  await e.click({ clickCount: 3 });
  await e.type(szoveg, { delay: 5 });
}
async function varUt(page, minta, ms = 20_000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    if (minta.test(utvonal(page))) return true;
    await var_(250);
  }
  return false;
}
async function lo(page, nev) {
  await var_(900);
  await page.screenshot({ path: join(ki, `k7c_bevezeto_${nev}.png`) });
  console.log(`kép: k7c_bevezeto_${nev}.png  ${utvonal(page)}`);
}
const szoveg = (page) => page.evaluate(() => document.body.innerText);

async function bongeszo(nev, fn) {
  const prof = join(tmpdir(), `kezjegy_k7c_${process.pid}_${nev}`);
  const b = await puppeteer.launch({ executablePath: process.env.CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true, userDataDir: prof, args: ['--no-first-run', '--hide-scrollbars'] });
  try {
    const page = await b.newPage();
    const hibak = [];
    page.on('pageerror', (e) => hibak.push(e.message));
    await page.setViewport({ width: 390, height: 844, deviceScaleFactor: 2 });
    await fn(page);
    ellenoriz(!hibak.length, `${nev}: nincs JS-hiba az oldalon${hibak.length ? ` (${hibak.join(' | ').slice(0, 300)})` : ''}`);
  } catch (e) {
    hibaDb++;
    console.log(`HIBA ${nev}: ${e.message}`);
  } finally {
    await b.close();
    rmSync(prof, { recursive: true, force: true });
  }
}

/** A real sign-up through the screens; returns the e-mail. The password is a throwaway local test value, never printed. */
async function regisztral(page, vezetek, kereszt, kepElotag) {
  const email = `k7c.${kereszt.toLowerCase()}.${futasId}@demo.kezjegy.test`;
  await page.goto(`${BASE}/regisztracio`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await page.waitForSelector('input[aria-label="Vezetéknév"]', { timeout: 60_000 });
  await var_(800);
  await ir(page, 'Vezetéknév', vezetek);
  await ir(page, 'Keresztnév', kereszt);
  await ir(page, 'E-mail-cím', email);
  await ir(page, 'Jelszó', `Proba-${randomBytes(9).toString('base64url')}-hosszu`);
  if (kepElotag) await lo(page, `${kepElotag}_regisztracio`);
  await kattint(page, 'Regisztrálok');
  ellenoriz(await varUt(page, /^\/email-megerosites/), `${kereszt}: a regisztráció után az e-mail-kód képernyő jön`);
  const [sor] = await sql(`select body_text from demo_outbox where template = 'auth_email_code' order by created_at desc limit 1`);
  const kod = String(sor?.body_text ?? '').match(/\b(\d{6})\b/)?.[1];
  ellenoriz(!!kod, `${kereszt}: a DEMO-postafiókban ott a 6 jegyű kód`);
  await ir(page, 'A kód a levélből', kod ?? '');
  if (kepElotag) await lo(page, `${kepElotag}_email_kod`);
  await kattint(page, 'Megerősítem');
  return email;
}
const ugyfelId = async (email) => (await sql(`select c.id from clients c join users u on u.id = c.user_id where u.email = '${email.replace(/'/g, "''")}'`))[0]?.id;
async function lepesKesz(clientId, step, status = 'kesz') {
  await sql(`insert into onboarding_steps (client_id, step, status, completed_at) values ('${clientId}', '${step}', '${status}', ${status === 'kesz' ? 'now()' : 'null'})
    on conflict (client_id, step) do update set status = excluded.status, completed_at = excluded.completed_at`);
}

// ---------- A) the owner's complaint: a real sign-up starts the guided run ----------
await bongeszo('A', async (page) => {
  await regisztral(page, 'Próba', 'Panna', 'A01');
  const w1 = await varUt(page, /^\/bevezeto\/udv/);
  await lo(page, 'A03_megerosites_utan');
  ellenoriz(w1, `A: a „Megerősítem” után az üdvözlő képernyő (W1) jön – most: ${utvonal(page)}`);
  ellenoriz((await szoveg(page)).includes('Szia Panna!'), 'A: W1 címe „Szia Panna!”');
  ellenoriz(!(await szoveg(page)).includes('Folytasd ott, ahol abbahagytad'), 'A: nincs „Folytasd ott, ahol abbahagytad”');
  await kattint(page, 'Tovább');
  await lo(page, 'A04_w2');
  await kattint(page, 'Tovább');
  await lo(page, 'A05_w3');
  await kattint(page, 'Kezdjük');
  ellenoriz(await varUt(page, /^\/bevezeto\/ut/), `A: „Kezdjük” → az elágazó kérdés (${utvonal(page)})`);
  await lo(page, 'A06_ut');
  await kattint(page, 'Később folytatom');
  ellenoriz(await varUt(page, /^\/bekotes/), 'A: „Később folytatom” → a bekötési lista');
  await var_(1500);
  const t = await szoveg(page);
  ellenoriz(t.includes('Folytasd ott, ahol abbahagytad'), 'A: aki elkezdte, annak a listán „Folytasd ott, ahol abbahagytad”');
  ellenoriz(!t.includes('0 / 1'), 'A: az elágazás előtt nincs „0 / 1 lépés kész”');
  await lo(page, 'A07_lista_szunet');
});

// ---------- B) never started + on the checklist → the start card ----------
await bongeszo('B', async (page) => {
  await regisztral(page, 'Kapu', 'Kinga', null);
  await varUt(page, /^\/bevezeto\/udv/);
  // straight to the checklist without touching the welcome screens (a link, the Fiók row, an old bookmark)
  await page.goto(`${BASE}/bekotes`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  await var_(2500);
  const t = await szoveg(page);
  await lo(page, 'B01_lista_soha_nem_kezdte');
  ellenoriz(t.includes('Végigvezetünk a beállításon'), 'B: soha el nem kezdett futásnál a kezdő kártya látszik');
  ellenoriz(!t.includes('Folytasd ott, ahol abbahagytad'), 'B: és nem „Folytasd ott, ahol abbahagytad”');
  await kattint(page, 'Kezdjük');
  ellenoriz(await varUt(page, /^\/bevezeto\/udv/), `B: „Kezdjük” → W1 (${utvonal(page)})`);
  await lo(page, 'B02_kezdjuk_utan');
});

// ---------- C + D) allowance gate "Később", then "Ezt kérem" on the meghatalmazás step, then the done screen ----------
await bongeszo('CD', async (page) => {
  const email = await regisztral(page, 'Kedv', 'Kornél', null);
  await varUt(page, /^\/bevezeto\/udv/);
  const id = await ugyfelId(email);
  ellenoriz(!!id, 'C: az új ügyfél megvan');
  // set-up through the data, not the screens tested above: welcome seen, "van" path, adószám known, adatok done
  await sql(`update clients set guided = '{"welcomeSeenAt":"2026-11-20T09:00:00Z"}'::jsonb, business_status = 'van', adoszam = '12345676-1-41' where id = '${id}'`);
  await lepesKesz(id, 'adatok');
  await page.goto(`${BASE}/bevezeto`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  ellenoriz(await varUt(page, /^\/kedvezmenyek\/kerdoiv/), `C: a vezetett futás a kedvezmény-kapunál (${utvonal(page)})`);
  await var_(1200);
  await lo(page, 'C01_kedvezmeny_kapu');
  await kattint(page, 'Később');
  const tovabb = await varUt(page, /^\/bekotes\/szerzodes/);
  await lo(page, 'C02_kedvezmeny_kesobb_utan');
  ellenoriz(tovabb, `C: a „Később” után a KÖVETKEZŐ lépés (szerződés) jön, nem ugyanaz a kapu – most: ${utvonal(page)}`);

  // D: contract, identification and card done in the data; the meghatalmazás step is the current one
  await lepesKesz(id, 'szerzodes');
  await lepesKesz(id, 'azonositas', 'konyvelore_var');
  await lepesKesz(id, 'elofizetes');
  await page.goto(`${BASE}/bevezeto`, { waitUntil: 'domcontentloaded', timeout: 60_000 });
  ellenoriz(await varUt(page, /^\/bekotes\/meghatalmazas/), `D: a vezetett futás a meghatalmazásnál (${utvonal(page)})`);
  await var_(1200);
  await lo(page, 'D01_meghatalmazas');
  await kattint(page, 'Ezt kérem');
  ellenoriz(await varUt(page, /^\/helyettunk.*vezetett=meghatalmazas/), `D: „Ezt kérem” → Intézzük helyetted, vezetetten (${utvonal(page)})`);
  await var_(1500);
  const t = await szoveg(page);
  ellenoriz(t.includes('Később folytatom') && /\d+ \/ \d+/.test(t), 'D: a vezetett fejléc (Később folytatom + haladás) ott van');
  ellenoriz(!t.includes('Dosszié') && !t.includes('Fotózás'), 'D: nincs fülsor');
  await lo(page, 'D02_helyettunk_vezetett');
  await kattint(page, 'Vissza');
  ellenoriz(await varUt(page, /^\/bekotes\/meghatalmazas/), `D: a „Vissza” a meghatalmazás lépésre visz (${utvonal(page)})`);
  await kattint(page, 'Ezt kérem');
  await varUt(page, /^\/helyettunk/);
  await var_(1200);
  await ir(page, 'Ezen a számon hívjunk', '+36 30 123 4567');
  await kattint(page, 'Kérem a visszahívást');
  await var_(2500);
  // the waiting screen once, then on
  if (/^\/bevezeto\/var/.test(utvonal(page))) {
    await lo(page, 'D03_var');
    await kattint(page, 'Tovább', { utolso: true });
  }
  const kesz = await varUt(page, /^\/bevezeto\/kesz/);
  await var_(1500);
  await lo(page, 'D04_kesz');
  ellenoriz(kesz, `D: a végén a kész-képernyő (${utvonal(page)})`);
  const k = await szoveg(page);
  const bar = k.match(/(\d+) \/ (\d+)/);
  const hianyzik = bar ? Number(bar[2]) - Number(bar[1]) : 0;
  ellenoriz(!(hianyzik > 0 && k.includes('Kész vagy a te részeddel!')), `D: nincs „Kész vagy a te részeddel!” a ${bar?.[0] ?? '?'} sáv mellett`);
  if (hianyzik > 0) ellenoriz(k.includes('Most nincs több teendőd') && k.includes(`Később még ${hianyzik} dolog kell tőled`), 'D: a kész-képernyő kimondja, mi jön még tőle később');
  await kattint(page, 'Főoldal');
  await varUt(page, /^\/bekotes/);
  await var_(2000);
  await lo(page, 'D05_lista_kesz_utan');
});

console.log(hibaDb ? `\n${hibaDb} HIBA` : '\nminden rendben');
process.exit(hibaDb ? 1 : 0);
