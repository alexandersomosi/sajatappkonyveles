// Round-1 fixer: logged-in panel journeys on the LOCAL harness (127.0.0.1:8842, real backend, demo seed).
import { mkdirSync, rmSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
const puppeteer = createRequire('C:/Users/UpgradePC/konyvelo_app/kod/panel/package.json')('puppeteer-core');
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const A = 'http://127.0.0.1:8841';
const B = 'http://127.0.0.1:8842';
const ki = process.env.KI || 'C:/Users/UpgradePC/konyvelo_app/kod/panel/_kepek';
const ELO = process.env.ELO || 'jav1_h_';
mkdirSync(ki, { recursive: true });
const var_ = (ms) => new Promise((r) => setTimeout(r, ms));
const eredmeny = [];
const ell = (nev, ok, reszlet = '') => { eredmeny.push({ nev, ok: !!ok }); console.log(`${ok ? 'OK  ' : 'HIBA'} ${nev}${reszlet ? ` – ${reszlet}` : ''}`); };
const api = async (kiNev, p, m = 'GET', b) => {
  const u = new URL(A + '/__helyi/api');
  u.searchParams.set('ki', kiNev); u.searchParams.set('m', m); u.searchParams.set('p', p);
  if (b) u.searchParams.set('b', JSON.stringify(b));
  const r = await fetch(u);
  const t = await r.text();
  try { return { s: r.status, j: JSON.parse(t) }; } catch { return { s: r.status, j: t }; }
};
const van = (page, t, ms = 5000) => page.waitForFunction((x) => document.body.innerText.includes(x), { timeout: ms }, t).then(() => true).catch(() => false);
const katt = async (page, t, sel = 'button, a, label') => {
  await page.evaluate((x, s) => {
    const el = [...document.querySelectorAll(s)].find((e) => e.textContent && e.textContent.replace(/\s+/g, ' ').trim().includes(x) && !e.disabled);
    if (!el) throw new Error('nincs ilyen elem: ' + x);
    el.scrollIntoView({ block: 'center' });
    el.click();
  }, t, sel);
  await var_(1200);
};
async function bongeszo(nev, fn, { szel = 1280, mag = 720 } = {}) {
  const prof = join(tmpdir(), `kj_jav1_ph_${process.pid}_${nev}_${Date.now()}`).replace(/\\/g, '/');
  const b = await puppeteer.launch({ executablePath: chrome, headless: true, userDataDir: prof, args: ['--no-first-run', '--no-default-browser-check', '--hide-scrollbars', '--force-device-scale-factor=1', '--lang=hu-HU'], defaultViewport: { width: szel, height: mag, deviceScaleFactor: 1 } });
  try {
    const page = await b.newPage();
    const hibak = [];
    page.on('pageerror', (e) => hibak.push(e.message));
    const kep = async (n, teljes = false) => { await var_(500); await page.screenshot({ path: `${ki}/${ELO}${n}.png`, fullPage: teljes }); };
    const megy = async (ut, be) => {
      await page.goto(be ? `${B}/__helyi/belep?ki=${be}&ide=${encodeURIComponent(ut)}` : `${B}${ut}`, { waitUntil: 'networkidle0', timeout: 60000 });
      await page.waitForFunction(() => !document.querySelector('.betoltes'), { timeout: 10000 }).catch(() => {});
      await var_(900);
    };
    const tul = () => page.evaluate(() => {
      const r = [];
      document.querySelectorAll('.lap').forEach((l) => { const t = l.querySelector(':scope > .tabla'); if (t && t.scrollWidth > l.clientWidth + 1) r.push(`tabla ${t.scrollWidth}>${l.clientWidth}`); });
      const f = document.querySelector('.fulek');
      if (f && f.scrollWidth > f.clientWidth + 1) r.push(`fulek ${f.scrollWidth}>${f.clientWidth}`);
      if (document.documentElement.scrollWidth > document.documentElement.clientWidth) r.push('oldal');
      return r;
    });
    await fn(page, { kep, megy, tul });
    if (hibak.length) ell(`${nev}: nincs oldalhiba`, false, hibak.join(' | ').slice(0, 300));
  } catch (e) {
    ell(nev, false, e.message);
    try { await (await b.pages()).at(-1)?.screenshot({ path: `${ki}/${ELO}${nev}_HIBA.png` }); } catch {}
  } finally {
    await b.close();
    try { rmSync(prof, { recursive: true, force: true }); } catch {}
  }
}
const cl = await api('bence', '/acc/clients?filter=mind');
const idOf = (n) => cl.j.items.find((c) => c.name.includes(n)).id;

const S = {
  async elteres() {
    const reka = idOf('Réka');
    await bongeszo('elteres', async (page, { kep, megy, tul }) => {
      await megy(`/ugyfelek/${reka}/ado?idoszak=2026-Q3`, 'bence');
      ell('1280: az Adó fülön semmi nem lóg ki', (await tul()).length === 0, JSON.stringify(await tul()));
      await katt(page, 'Eltérés van');
      await page.evaluate(() => document.querySelector('.fiok-lap input[type=checkbox]')?.click());
      await page.type('.fiok-lap textarea', 'A TB-járulékot kevesebbel utaltad, a különbséget pótold.');
      await katt(page, 'Elküldöm', '.fiok-lap button');
      ell('eltérés után: „Rendben, pótolta” lehetőség', await van(page, 'Rendben, pótolta'));
      await kep('elteres_01_jelezve', true);
      const elotte = await fetch(`${A}/__helyi/sql?q=${encodeURIComponent("select count(*)::int as n from notifications where kind = 'tax_payment_mismatch'")}`).then((r) => r.json()).catch(() => null);
      await katt(page, 'Rendben, láttam');
      ell('a többi rendben: a visszajelzés szerint az eltérés még nyitva', await van(page, 'eltérés még nyitva van'));
      const utana = await fetch(`${A}/__helyi/sql?q=${encodeURIComponent("select count(*)::int as n from notifications where kind = 'tax_payment_mismatch'")}`).then((r) => r.json()).catch(() => null);
      console.log('   tax_payment_mismatch értesítések száma előtte/utána (backend):', JSON.stringify(elotte), JSON.stringify(utana));
      await kep('elteres_02_tobbi_rendben', true);
      await katt(page, 'Rendben, pótolta', 'button');
      ell('pótlás után: „Befizetve, ellenőrizve”', await van(page, 'ellenőrizve') && !(await van(page, 'Eltérést jeleztél', 1200)));
      await kep('elteres_03_lezarva', true);
    });
  },
  async kezi() {
    const kata = idOf('Kata');
    await bongeszo('kezi', async (page, { kep, megy, tul }) => {
      await megy(`/ugyfelek/${kata}/ado?idoszak=2026-Q4`, 'bence');
      ell('kézi módosítás: áthúzott számítás + indok a panelen', (await page.$('.athuzott')) !== null && (await van(page, 'az ügyfél is látja')) && (await van(page, 'kézzel módosította az összeget')));
      ell('1280: semmi nem lóg ki (Kata, Adó)', (await tul()).length === 0, JSON.stringify(await tul()));
      await kep('kezi_01_ado_1280', true);
      await megy(`/ugyfelek/${kata}/uzenetek`);
      const m = await page.evaluate(() => ({ iro: Math.round(document.querySelector('.iro-sor').getBoundingClientRect().bottom), ablak: window.innerHeight }));
      ell('1280×720: az üzenetíró látszik görgetés nélkül', m.iro <= m.ablak, JSON.stringify(m));
      await kep('kezi_02_uzenetek_1280');
      await megy('/ugyfelek');
      ell('1280: az ügyféllista nem lóg ki', (await tul()).length === 0, JSON.stringify(await tul()));
      await kep('kezi_03_ugyfelek_1280');
    });
  },
  async ketlepcsos() {
    await bongeszo('2fa', async (page, { kep, megy }) => {
      await megy('/beallitasok', 'bence');
      await fetch(`${A}/__helyi/ido?perc=16`);
      await katt(page, 'Bekapcsolom', 'button');
      await var_(1500);
      ell('régi belépés: jelszómező a fiókban', (await page.$('.fiok-lap input[type=password]')) !== null && (await van(page, 'több mint 10 perce léptél be')));
      await kep('2fa_01_jelszo_kell');
      const pw = await (await fetch(`${A}/__helyi/jelszo?ki=bence`)).text();
      await page.type('.fiok-lap input[type=password]', pw, { delay: 15 });
      await katt(page, 'Tovább', '.fiok-lap button');
      await var_(1500);
      ell('jelszó után megjön a QR-kód', (await page.$('.fiok-lap img[alt^="QR"]')) !== null);
      await page.evaluate(() => { const i = document.querySelector('.fiok-lap input[type=password]'); if (i) i.value = ''; });
      await kep('2fa_02_qr');
    });
    await fetch(`${A}/__helyi/ido?perc=-16`);
  },
  async admin() {
    await bongeszo('admin', async (page, { kep, megy, tul }) => {
      await megy('/admin/csapat', 'admin');
      ell('1280: a csapat-tábla elfér', (await tul()).length === 0, JSON.stringify(await tul()));
      await kep('admin_01_csapat_1280');
      await megy('/admin/elofizetesek');
      ell('1280: az előfizetések táblája elfér', (await tul()).length === 0, JSON.stringify(await tul()));
      const fej = await page.evaluate(() => document.querySelector('.fejlec .mellek')?.innerText);
      await kep('admin_02_elofizetesek_1280');
      await megy('/admin');
      const mrr = await page.evaluate(() => document.querySelector('.fejlec .nagyszam')?.innerText.replace(/\s+/g, ' '));
      ell('ugyanaz az MRR a két oldalon', !!mrr && !!fej && fej.replace(/\s+/g, ' ').includes(mrr.replace(/ Ft$/, '')), `${mrr} | ${fej}`);
      await megy('/admin/naplo');
      const nyers = await page.evaluate(() => [...document.querySelectorAll('td.utolso')].map((t) => t.textContent).filter((t) => /\b(cutoff|withExpected|afaMentes|ki: staff)\b/.test(t) || /[0-9a-f]{8}-[0-9a-f]{4}-/.test(t)));
      ell('napló: nincs nyers kulcs vagy azonosító a részletekben', nyers.length === 0, JSON.stringify(nyers.slice(0, 5)));
      await kep('admin_03_naplo_1280');
    });
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
