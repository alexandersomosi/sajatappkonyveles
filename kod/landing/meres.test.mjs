#!/usr/bin/env node
// SPEC §31 – the adozz.hu page script (dist/js/meres.js), run in jsdom (from kod/panel):
//  - the channel of the visit (= the Umami tag) by the shared rule; the statistics get no click id and no other parameter;
//  - the app links take utm_*, the referring domain and the landing path along; the legal links stay clean;
//  - nothing is stored and nothing is fetched in the normal build; no ad code at all in it;
//  - the statistics script is loaded by meres.js itself (never unfiltered); the button clicks never wait for it;
//  - the ad build: still nothing while the server says ads:false; with ads:true the banner comes first, no Meta/Google
//    script before "Elfogadom", none after "Elutasítom"; "Elfogadom" loads them and the links get the decision id.
//   node --test kod/landing/meres.test.mjs   (builds the page itself; the ad variant goes to a temporary folder)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdtempSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ITT = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(ITT, '../panel/package.json'));
const { JSDOM } = require('jsdom');
// acorn (from kod/app) only checks that removing the comments of mozgas.js left every token as it was
const acorn = createRequire(join(ITT, '../app/package.json'))('acorn');
const { cssMegjegyzesNelkul, jsMegjegyzesNelkul } = await import('./megjegyzes.mjs');

function epit(env = {}) {
  execFileSync(process.execPath, [join(ITT, 'build.mjs')], { env: { ...process.env, ...env }, stdio: 'pipe' });
}

// the real build (kod/landing/dist, with the real meres.json) – what feltolt.sh uploads
epit();
const VALOS = JSON.parse(readFileSync(join(ITT, 'meres.json'), 'utf8'));
const valosJs = readFileSync(join(ITT, 'dist', 'js', 'meres.js'), 'utf8');
// the build WITHOUT statistics (an empty website id) for the first tests, in a temporary folder
const D0 = mkdtempSync(join(tmpdir(), 'kj-landing-0-'));
writeFileSync(join(D0, 'meres.json'), JSON.stringify({ ...VALOS, umamiWebsiteId: '', hirdetes: false }));
epit({ LANDING_KI: join(D0, 'dist'), LANDING_MERES: join(D0, 'meres.json') });
const DIST = join(D0, 'dist');
const html = readFileSync(join(DIST, 'index.html'), 'utf8');
const js = readFileSync(join(DIST, 'js', 'meres.js'), 'utf8');

test('the real build follows meres.json (statistics on only with the website id; never ad code with hirdetes:false)', () => {
  if (VALOS.umamiWebsiteId) assert.ok(valosJs.includes(`"websiteId":"${VALOS.umamiWebsiteId}"`));
  else assert.doesNotMatch(valosJs, /"websiteId"/);
  if (VALOS.hirdetes !== true) assert.doesNotMatch(valosJs, /connect\.facebook\.net|googletagmanager|fbq\(|gtag\(|hozzajarulas/);
});

/** The page in jsdom at `url` with `referrer`; the script runs once; fetch and storage are spied. */
function oldal(o = {}) {
  const dom = new JSDOM(o.html ?? html, { url: o.url ?? 'https://adozz.hu/', referrer: o.referrer, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  const hivasok = [];
  w.fetch = async (url, init) => {
    hivasok.push({ url: String(url), body: init?.body ?? null });
    const v = o.valasz?.(String(url), init);
    return { ok: true, json: async () => v ?? {} };
  };
  const tar = [];
  const eredeti = w.localStorage;
  Object.defineProperty(w, 'localStorage', {
    get() {
      tar.push('localStorage');
      return eredeti;
    },
  });
  w.eval(o.js ?? js);
  return { w, d: w.document, hivasok, tar };
}
const varj = () => new Promise((r) => setTimeout(r, 30));
/** The hero's Regisztrálok button. 11-21, new design: the buttons carry the design's classes (gomb gomb-fo) and the header
 *  button comes first in the page, so the hero one is picked by its event place (it was `a.gomb-e`, the first such link). */
const HOS_REG = 'a[data-kj-esemeny="regisztralok"][data-kj-hely="hos"]';

test('normal build: one own script, no ad code, footer says the truth, events on the buttons', () => {
  assert.match(html, /<script defer src="js\/meres\.js"><\/script>/);
  assert.doesNotMatch(html, /\/m\/script\.js/); // never a tag in the page: meres.js loads it (with the website id)
  assert.doesNotMatch(js, /\/m\/script\.js"|websiteId":"[0-9a-f]/); // no website id yet → nothing to load
  assert.doesNotMatch(js, /connect\.facebook\.net|googletagmanager|fbq\(|gtag\(|hozzajarulas/);
  // 11-21, new design: the footer line has no class of its own (the dark footer styles it; it was class="halvany")
  assert.match(html, /<p id="meres-lablec">Ez az oldal nem használ sütit\.<\/p>/);
  assert.doesNotMatch(html, /nem követ/);
  assert.match(html, /href="https:\/\/app\.adozz\.hu\/jogi\/suti">Süti-tájékoztató</);
  assert.match(html, /data-kj-esemeny="regisztralok" data-kj-hely="hos"/);
  assert.match(html, /data-kj-esemeny="visszahivas"/);
  assert.doesNotMatch(html, /data-umami-event/); // the Umami tracker would hold the link until its request ends
  // 11-21, new design: the section has the design's classes (was class="szak"); the id is what the "arak-lathato" event needs
  assert.match(html, /<section class="[^"]*" id="arak">/);
  assert.match(html, /A csapatunk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között\./);
  assert.doesNotMatch(html, /a\(z\)/);
  assert.doesNotMatch(html, /<script>(?!<)/); // nothing inline (CSP script-src 'self')
});

test('channel = the shared rule; the statistics filter keeps utm_* only and cuts the referrer to its site', () => {
  let p = oldal({ url: 'https://adozz.hu/?utm_source=fb&gclid=abc', referrer: 'https://www.youtube.com/watch?v=1' });
  assert.equal(p.w.umamiConfig.tag, 'facebook');
  p = oldal({ referrer: 'https://m.youtube.com/watch?v=1' });
  assert.equal(p.w.umamiConfig.tag, 'youtube');
  p = oldal({ referrer: 'https://adozz.hu/' });
  assert.equal(p.w.umamiConfig.tag, 'kozvetlen');
  p = oldal({});
  assert.equal(p.w.umamiConfig.tag, 'kozvetlen');
  const ki = p.w.adozzStatSzuro('event', { url: 'https://adozz.hu/?utm_source=youtube&utm_campaign=v1&gclid=x&fbclid=y&wbraid=z&ref=KATA1234#arak', referrer: 'https://www.google.hu/search?q=konyvelo+neve', website: 'w' });
  assert.equal(ki.url, 'https://adozz.hu/?utm_source=youtube&utm_campaign=v1');
  assert.equal(ki.referrer, 'https://www.google.hu/');
  assert.equal(ki.website, 'w');
});

test('app links carry utm_*, the referring domain and the landing path; legal links stay clean; nothing stored or fetched', async () => {
  const p = oldal({ url: 'https://adozz.hu/?utm_source=youtube&utm_medium=video&utm_campaign=atalanyado-2027&gclid=nem-megy-at', referrer: 'https://www.youtube.com/' });
  await varj();
  const reg = new URL(p.d.querySelector(HOS_REG).href);
  assert.equal(reg.origin + reg.pathname, 'https://app.adozz.hu/regisztracio');
  assert.equal(reg.searchParams.get('utm_source'), 'youtube');
  assert.equal(reg.searchParams.get('utm_campaign'), 'atalanyado-2027');
  assert.equal(reg.searchParams.get('hivatkozo'), 'youtube.com');
  assert.equal(reg.searchParams.get('erkezes'), '/');
  assert.equal(reg.searchParams.get('gclid'), null); // click ids only with ad consent
  const vissza = new URL(p.d.querySelector('a[data-kj-esemeny="visszahivas"]').href);
  assert.equal(vissza.searchParams.get('cel'), 'visszahivas');
  assert.equal(vissza.searchParams.get('utm_source'), 'youtube');
  for (const a of p.d.querySelectorAll('a[href*="/jogi/"]')) assert.equal(new URL(a.href).search, '');
  assert.deepEqual(p.hivasok, []);
  assert.deepEqual(p.tar, []); // the off switch reads storage only when the statistics are on
  assert.equal(p.d.cookie, '');
  assert.equal(p.d.querySelectorAll('script[src*="facebook"], script[src*="google"]').length, 0);
});

test('new design (11-21): own files only, motion script and e-mail logos in the build, every app link and button wired, prices from arak.json', async () => {
  // the two own scripts, nothing inline, nothing from another server (CSP default-src 'self'; script-src 'self'; style-src 'self')
  assert.match(html, /<script defer src="js\/mozgas\.js"><\/script>/);
  // 11-21 (going live): the design's motion script without its comments (working notes), every token unchanged
  const mozgasForras = readFileSync(join(ITT, 'mozgas.js'), 'utf8');
  const mozgasKi = readFileSync(join(DIST, 'js', 'mozgas.js'), 'utf8');
  assert.equal(mozgasKi, jsMegjegyzesNelkul(mozgasForras));
  const tokenek = (src, megj) => [...acorn.tokenizer(src, { ecmaVersion: 'latest', onComment: megj })].map((t) => `${t.type.label}|${t.value ?? ''}`);
  const megjegyzesek = [];
  assert.deepEqual(tokenek(mozgasKi, megjegyzesek), tokenek(mozgasForras));
  assert.equal(megjegyzesek.length, 0, 'mozgas.js: megjegyzés maradt');
  // the stylesheet: the design's CSS without its comments (nothing else changed)
  const cssKi = readFileSync(join(DIST, 'stilus.css'), 'utf8');
  const cssForras = readFileSync(join(ITT, 'stilus.css'), 'utf8');
  assert.doesNotMatch(cssKi, /\/\*|\*\//);
  const lapos = (s) => s.replace(/\s+/g, '');
  assert.equal(lapos(cssKi), lapos(cssForras.replace(/\/\*[\s\S]*?\*\//g, '')));
  assert.equal(cssKi, cssMegjegyzesNelkul(cssForras));
  // no public file carries an AI mention or a working note; the phone frame's origin note is not published
  const fajlok = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? fajlok(join(d, f)) : [join(d, f)]));
  for (const f of fajlok(DIST).filter((f) => /\.(html|css|js|md|txt|svg)$/.test(f))) {
    const sz = readFileSync(f, 'utf8');
    assert.doesNotMatch(sz, /\bAI\b|mesterséges intelligencia|\bMI-vel\b|\btulaj(?!don)|_eszkoz|C5_v2|epit\.cjs|Kovács Bence/i, f);
  }
  assert.ok(!existsSync(join(DIST, 'kepek', 'LICENC_telefon_keret.txt')));
  // only what is true today: card payment only (ÁSZF 6.2), the company's management can open documents (logged)
  assert.doesNotMatch(html, /átutalással|csak a könyvelőd látja/);
  assert.equal((html.match(/bankkártyával\./g) || []).length, 3);
  assert.match(html, /Gépen az app ma még telefonos elrendezésben nyílik meg\./);
  // 11-21 text fixes (owner): no liability sentence anywhere on the page (text, FAQ, alt texts, meta), and no phone number yet
  assert.doesNotMatch(html, /\bfelel(?!őtlen)|felelős|felelünk|megtérít|kártérít|garant|helytáll/i);
  assert.match(html, /A szerződést a <span class="nowrap">Somosi Kft\.-vel<\/span> kötöd, a könyvelőd a mi megbízásunkból dolgozik neked\./);
  assert.doesNotMatch(html, /href="tel:|\+36[ -]?\d|[Tt]elefonszámunk/);
  // the server sentence agrees with the footer's hosting provider (Germany, EU); ONYA is always explained
  assert.equal((html.match(/Az Európai Unióban (tároljuk őket )?\(a szerverünk Németországban van\)/g) || []).length, 2);
  assert.match(html, /Tárhelyszolgáltató<\/dt><dd>[^<]*Németország<\/dd>/);
  assert.doesNotMatch(html, /Európai szerveren/);
  assert.doesNotMatch(html, /(?<!\()ONYA-n\b/);
  // the hero says it is for starters too; the price list says what is for whom; the FAQ has the switch question
  assert.match(html, /<p class="hos-elo">Online könyvelés egyéni vállalkozóknak, akkor is, ha most indulsz<\/p>/);
  assert.match(html, /Átalányadózóként: a negyedéves adód és járulékaid kiszámítása és bevallása/);
  assert.match(html, /<p class="ar-szavak">Szja-előleg:/);
  assert.match(html, /<summary>Hogyan váltok a régi könyvelőmtől\?<\/summary>/);
  // the VAT-exemption limit is the 2026 one (NAV 2025-12-11, Áfa tv. 188. § (2)) – rewrite before 2027-01-01 (22 millió)
  assert.match(html, /2026-ban évi 20&nbsp;millió&nbsp;Ft bevételig/);
  assert.doesNotMatch(readFileSync(join(DIST, 'js', 'mozgas.js'), 'utf8'), /fetch\(|XMLHttpRequest|sendBeacon|localStorage|document\.cookie/);
  assert.doesNotMatch(html, /\sstyle=|<style|\son[a-z]+=/i);
  assert.doesNotMatch(html, /\s(src|srcset)="[^"]*(https?:)?\/\//i);
  assert.doesNotMatch(html, /<!--/);
  // the mails and the owner's signature link these two (the folder is replaced as a whole on the server)
  for (const f of ['logo_feher@2x.png', 'logo_alairas@2x.png']) assert.ok(statSync(join(DIST, 'email', f)).size > 0, f);
  // every Regisztrálok / Belépés / visszahívás / e-mail link sends its event, with the place of the button
  const helyek = (nev) => [...html.matchAll(new RegExp(`data-kj-esemeny="${nev}" data-kj-hely="([a-z]+)"`, 'g'))].map((m) => m[1]);
  assert.deepEqual(helyek('regisztralok'), ['fejlec', 'hos', 'arak', 'zaro', 'lab']);
  assert.deepEqual(helyek('belepes'), ['fejlec', 'menu', 'lab']);
  assert.deepEqual(helyek('visszahivas'), ['zaro']);
  assert.ok(helyek('email-iras').length >= 4);
  // 11-21 text fixes: the label says that the button leads to the registration first (the link and the event are unchanged)
  assert.match(html, /href="https:\/\/app\.adozz\.hu\/regisztracio\?cel=visszahivas" data-kj-esemeny="visszahivas" data-kj-hely="zaro">Regisztrálok, és visszahívást kérek</);
  assert.match(html, /A visszahíváshoz előbb regisztrálsz: a neved, az e-mail-címed és egy jelszó kell, kártya nem\./);
  assert.match(html, /nincs követő süti/); // true here: no ad code can be in this build, the statistics use no cookie
  // every app link (not the legal pages) takes the campaign along
  const p = oldal({ url: 'https://adozz.hu/?utm_source=youtube&utm_campaign=proba', referrer: 'https://www.youtube.com/' });
  await varj();
  const app = [...p.d.querySelectorAll('a[href^="https://app.adozz.hu/"]')];
  const jogi = app.filter((a) => /\/jogi\//.test(a.getAttribute('data-alap-href') || a.href));
  assert.deepEqual([...new Set(jogi.map((a) => new URL(a.href).pathname))].sort(), ['/jogi/adatkezeles', '/jogi/aszf', '/jogi/suti']);
  const tobbi = app.filter((a) => !jogi.includes(a));
  assert.ok(tobbi.length >= 9, `app links: ${tobbi.length}`);
  for (const a of tobbi) {
    const u = new URL(a.href);
    assert.equal(u.searchParams.get('utm_source'), 'youtube', a.href);
    assert.equal(u.searchParams.get('utm_campaign'), 'proba', a.href);
    assert.equal(u.searchParams.get('hivatkozo'), 'youtube.com', a.href);
  }
  // the prices of the page are the generated ones (FEE_DEFAULTS → arak.json), with the yearly total
  const arak = JSON.parse(readFileSync(join(ITT, 'arak.json'), 'utf8'));
  const nb = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '&nbsp;');
  for (const s of arak.sorok) assert.ok(html.includes(`${nb(s.osszegHuf)}&nbsp;Ft`), s.kind);
  const ar = Object.fromEntries(arak.sorok.map((s) => [s.kind, s.osszegHuf]));
  assert.ok(html.includes(`<b>${nb(ar.havidij * 12 + ar.eves_zaras)}&nbsp;Ft</b>`));
});

test('statistics on: meres.js loads the Umami script with the tag, DNT and the filter; clicks never wait; the off switch writes only when clicked', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kj-landing-'));
  const meres = join(dir, 'meres.json');
  writeFileSync(meres, JSON.stringify({ umamiWebsiteId: '0b7a4a52-6c55-4a1e-9a0e-2a1b3c4d5e6f', domains: ['adozz.hu'], doNotTrack: true, hirdetes: false }));
  epit({ LANDING_KI: join(dir, 'dist'), LANDING_MERES: meres });
  const h2 = readFileSync(join(dir, 'dist', 'index.html'), 'utf8');
  const j2 = readFileSync(join(dir, 'dist', 'js', 'meres.js'), 'utf8');
  assert.doesNotMatch(h2, /\/m\/script\.js/); // not in the page: if meres.js does not run, the statistics do not run either
  assert.match(h2, /Ez az oldal nem használ sütit\. A látogatottságot saját szerverünkön, süti nélkül, összesítve mérjük\./);
  const p = oldal({ html: h2, js: j2, url: 'https://adozz.hu/?utm_source=youtube&utm_campaign=proba', referrer: 'https://www.youtube.com/' });
  await varj();
  const s = p.d.querySelector('script[src="/m/script.js"]');
  assert.ok(s, 'meres.js added the statistics script');
  assert.equal(s.getAttribute('data-website-id'), '0b7a4a52-6c55-4a1e-9a0e-2a1b3c4d5e6f');
  assert.equal(s.getAttribute('data-domains'), 'adozz.hu');
  assert.equal(s.getAttribute('data-before-send'), 'adozzStatSzuro');
  assert.equal(s.getAttribute('data-do-not-track'), 'true');
  assert.equal(s.getAttribute('data-tag'), 'youtube');
  assert.equal(typeof p.w.adozzStatSzuro, 'function', 'the filter exists before the script can run');
  // a click: the event goes without holding the link (no preventDefault), with the place of the button
  const kuldott = [];
  p.w.umami = { track: (nev, adat) => (kuldott.push([nev, adat]), new Promise(() => {})) };
  const reg = p.d.querySelector(HOS_REG); // 11-21: the header's Regisztrálok (hely: fejlec) comes first in the new design
  const ev = new p.w.MouseEvent('click', { bubbles: true, cancelable: true });
  reg.dispatchEvent(ev);
  assert.equal(ev.defaultPrevented, false);
  assert.equal(JSON.stringify(kuldott), JSON.stringify([['regisztralok', { hely: 'hos' }]]));
  const gomb = p.d.getElementById('meres-kapcsolo');
  assert.equal(gomb.hidden, false);
  assert.match(gomb.textContent, /Ne mérjétek/);
  gomb.click();
  assert.equal(p.w.localStorage.getItem('umami.disabled'), '1');
  assert.equal(gomb.textContent, 'Újra mérhetitek');
  assert.match(p.d.getElementById('meres-visszajelzes').textContent, /ezen a böngészőn nem mérjük/);
  gomb.click();
  assert.equal(p.w.localStorage.getItem('umami.disabled'), null);
});

test('ad build: server off → nothing; server on → banner first, nothing loads before or after "Elutasítom"; "Elfogadom" loads and passes the decision id', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'kj-landing-h-'));
  const meres = join(dir, 'meres.json');
  writeFileSync(meres, JSON.stringify({ umamiWebsiteId: '', domains: ['adozz.hu'], doNotTrack: true, hirdetes: true }));
  epit({ LANDING_KI: join(dir, 'dist'), LANDING_MERES: meres });
  const h3 = readFileSync(join(dir, 'dist', 'index.html'), 'utf8');
  const j3 = readFileSync(join(dir, 'dist', 'js', 'meres.js'), 'utf8');
  assert.match(h3, /id="suti-beallitasok" hidden/);
  // 11-21: „nincs követő süti” only in a build that cannot hold ad code
  assert.doesNotMatch(h3, /nincs követő süti/);
  assert.match(h3, /Nem adjuk el az adataidat, és nem mutatunk hirdetést\./);
  const kulso = (d) => d.querySelectorAll('script[src*="facebook"], script[src*="googletagmanager"]').length;

  // the server switch is off
  let p = oldal({ html: h3, js: j3, url: 'https://adozz.hu/?gclid=G1&fbclid=F1', valasz: (u) => (u.endsWith('/marketing-config') ? { ads: false } : undefined) });
  await varj();
  assert.deepEqual(p.hivasok.map((x) => x.url), ['/api/v1/public/marketing-config']);
  assert.equal(p.d.querySelector('.hj-ablak'), null);
  assert.equal(kulso(p.d), 0);
  assert.equal(p.d.cookie, '');

  const be = { ads: true, noticeVersion: '1', metaPixelId: '123456789012345', googleTagId: 'AW-1234567890' };
  // on: the banner, equal buttons, nothing loaded yet; "Elutasítom" → still nothing, only the choice cookie
  p = oldal({ html: h3, js: j3, url: 'https://adozz.hu/?gclid=G1&fbclid=F1', valasz: (u) => (u.endsWith('/marketing-config') ? be : { id: null }) });
  await varj();
  const ablak = p.d.querySelector('.hj-ablak');
  assert.ok(ablak);
  const gombok = [...ablak.querySelectorAll('.hj-gombok button')].map((b) => [b.textContent, b.className]);
  assert.deepEqual(gombok.slice(0, 2), [['Elfogadom', 'hj-gomb'], ['Elutasítom', 'hj-gomb']]);
  assert.ok([...ablak.querySelectorAll('input[type=checkbox]')].every((c) => !c.checked));
  // the lawyer's texts; no "personalised ads" choice (2.18.: no remarketing)
  assert.match(ablak.textContent, /az első fizetésedről is jelzést kapnak/);
  assert.match(ablak.textContent, /Feltétlenül szükséges/);
  assert.deepEqual([...ablak.querySelectorAll('input[type=checkbox]')].map((c) => c.getAttribute('data-kulcs')), ['m', 'g']);
  assert.doesNotMatch(ablak.textContent, /személyre szabott|hash/);
  assert.match(p.d.getElementById('meres-lablec').textContent, /kj_hozzajarulas/);
  assert.equal(kulso(p.d), 0);
  [...ablak.querySelectorAll('button')].find((b) => b.textContent === 'Elutasítom').click();
  await varj();
  assert.equal(kulso(p.d), 0);
  assert.equal(p.d.querySelector('.hj-ablak'), null);
  assert.match(p.d.cookie, /kj_hozzajarulas=/);
  assert.equal(new URL(p.d.querySelector(HOS_REG).href).searchParams.get('gclid'), null);

  // "Elfogadom": the decision is recorded, the two scripts load, the app link gets the decision id + click ids
  p = oldal({ html: h3, js: j3, url: 'https://adozz.hu/?gclid=G1&fbclid=F1', valasz: (u) => (u.endsWith('/marketing-config') ? be : { id: '6a1f0d6e-2a7e-4a8e-9a39-6f3c1c8a1b11' }) });
  await varj();
  [...p.d.querySelectorAll('.hj-ablak button')].find((b) => b.textContent === 'Elfogadom').click();
  await varj();
  const post = p.hivasok.find((x) => x.url === '/api/v1/public/hozzajarulas');
  assert.deepEqual(JSON.parse(post.body), { meta: true, google: true });
  assert.equal(kulso(p.d), 2);
  const reg = new URL(p.d.querySelector(HOS_REG).href);
  assert.equal(reg.searchParams.get('hid'), '6a1f0d6e-2a7e-4a8e-9a39-6f3c1c8a1b11');
  assert.equal(reg.searchParams.get('gclid'), 'G1');
  assert.equal(reg.searchParams.get('fbclid'), 'F1');
  assert.doesNotMatch(JSON.stringify(p.w.dataLayer.map((x) => [...x])), /"ad_personalization":"granted"/);

  // next visit with that decision: the server says it was withdrawn in the app → ad cookies go, the banner asks again
  const suti = p.d.cookie.match(/kj_hozzajarulas=[^;]*/)[0];
  p = oldal({ html: h3, js: j3, valasz: (u) => (u.endsWith('/marketing-config') ? be : u.includes('/hozzajarulas/') ? { ervenyes: false } : { id: null }) });
  p.d.cookie = suti + '; Path=/';
  p.d.cookie = '_fbp=fb.1.1.1; Path=/';
  await varj();
  await varj();
  assert.ok(p.hivasok.some((x) => x.url === '/api/v1/public/hozzajarulas/6a1f0d6e-2a7e-4a8e-9a39-6f3c1c8a1b11'));
  assert.ok(p.d.querySelector('.hj-ablak'), 'asks again');
  assert.equal(kulso(p.d), 0);
  assert.doesNotMatch(p.d.cookie, /_fbp=/);
  // still valid → loads without asking
  p = oldal({ html: h3, js: j3, valasz: (u) => (u.endsWith('/marketing-config') ? be : u.includes('/hozzajarulas/') ? { ervenyes: true } : { id: null }) });
  p.d.cookie = suti + '; Path=/';
  await varj();
  await varj();
  assert.equal(p.d.querySelector('.hj-ablak'), null);
  assert.equal(kulso(p.d), 2);
});
