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
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ITT = dirname(fileURLToPath(import.meta.url));
const require = createRequire(join(ITT, '../panel/package.json'));
const { JSDOM } = require('jsdom');

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

test('normal build: one own script, no ad code, footer says the truth, events on the buttons', () => {
  assert.match(html, /<script defer src="js\/meres\.js"><\/script>/);
  assert.doesNotMatch(html, /\/m\/script\.js/); // never a tag in the page: meres.js loads it (with the website id)
  assert.doesNotMatch(js, /\/m\/script\.js"|websiteId":"[0-9a-f]/); // no website id yet → nothing to load
  assert.doesNotMatch(js, /connect\.facebook\.net|googletagmanager|fbq\(|gtag\(|hozzajarulas/);
  assert.match(html, /<p class="halvany" id="meres-lablec">Ez az oldal nem használ sütit\.<\/p>/);
  assert.doesNotMatch(html, /nem követ/);
  assert.match(html, /href="https:\/\/app\.adozz\.hu\/jogi\/suti">Süti-tájékoztató</);
  assert.match(html, /data-kj-esemeny="regisztralok" data-kj-hely="hos"/);
  assert.match(html, /data-kj-esemeny="visszahivas"/);
  assert.doesNotMatch(html, /data-umami-event/); // the Umami tracker would hold the link until its request ends
  assert.match(html, /<section class="szak" id="arak">/);
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
  const reg = new URL(p.d.querySelector('a.gomb-e').href);
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
  const reg = p.d.querySelector('a[data-kj-esemeny="regisztralok"]');
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
  assert.equal(new URL(p.d.querySelector('a.gomb-e').href).searchParams.get('gclid'), null);

  // "Elfogadom": the decision is recorded, the two scripts load, the app link gets the decision id + click ids
  p = oldal({ html: h3, js: j3, url: 'https://adozz.hu/?gclid=G1&fbclid=F1', valasz: (u) => (u.endsWith('/marketing-config') ? be : { id: '6a1f0d6e-2a7e-4a8e-9a39-6f3c1c8a1b11' }) });
  await varj();
  [...p.d.querySelectorAll('.hj-ablak button')].find((b) => b.textContent === 'Elfogadom').click();
  await varj();
  const post = p.hivasok.find((x) => x.url === '/api/v1/public/hozzajarulas');
  assert.deepEqual(JSON.parse(post.body), { meta: true, google: true });
  assert.equal(kulso(p.d), 2);
  const reg = new URL(p.d.querySelector('a.gomb-e').href);
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
