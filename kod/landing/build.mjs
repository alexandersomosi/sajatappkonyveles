#!/usr/bin/env node
// SPEC §29.3.6 – the adozz.hu landing page: static HTML + CSS + two own scripts, no cookie, nothing from another server.
// 2026-11-21: the page is the owner-approved design (dizajn/landing_v2_proba4, „Jó lesz így a weboldal”), moved here:
//   oldal.sablon.html (the design's template; {{…}} filled below) + stilus.css + mozgas.js + kepek/ + fontok/ + vendor/
//   + ikonok.json (the Fluent icons the template uses, from dizajn/C5_v2/v2.js via ikonok.mjs).
// SPEC §31 (2026-11-20): js/meres.js (generated below from meres-sablon.js + kod/shared/src/marketing.ts) passes the source
// to the app links and – when meres.json has the website id – loads our own cookie-less statistics script (Umami,
// /m/script.js) ITSELF, after its filter is set (so the statistics never run without the filter). The button events
// (data-kj-esemeny / data-kj-hely) are sent by meres.js without waiting (no data-umami-event: the Umami tracker would hold
// the navigation until its request ends). The visible texts of the footer switch and of the cookie banner come from
// kod/jogi/app_szovegek.json (the lawyer's copy). The ad code and the banner are in the page only with "hirdetes": true
// (and then still only run with the server switch on).
// js/mozgas.js: the design's motion (mobile menu, the clickable hero phone, the sticky demo), unchanged; no tracking.
// 2026-11-21 (going live): the public stilus.css and js/mozgas.js are the sources WITHOUT their comments (megjegyzes.mjs –
// the design's comments are working notes), LICENC_*.txt of kepek/ stays out, and every text file of the output is checked
// for AI mentions and internal notes (not only index.html).
// Prices come from ONE generated file (arak.json, made here from FEE_DEFAULTS of kod/shared – no hand-typed prices);
// the company data from kod/shared/brand.json. Output: kod/landing/dist/ (what feltolt.sh uploads to /srv/kezjegy/web/landing).
// Caching: the server answers every landing file with "Cache-Control: no-cache" (deploy/web.Caddyfile, kezjegy_statikus),
// so the file names are not hashed – a new deploy is seen at the next load.
//   node kod/landing/build.mjs          (Node ≥ 23: reads the shared .ts with type stripping)
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';
import { cssMegjegyzesNelkul, jsMegjegyzesNelkul } from './megjegyzes.mjs';

const ITT = dirname(fileURLToPath(import.meta.url));
const KOD = resolve(ITT, '..');
// LANDING_KI / LANDING_MERES: only for the tests (meres.test.mjs builds the other variants into a temporary folder)
const KI = process.env.LANDING_KI ? resolve(process.env.LANDING_KI) : join(ITT, 'dist');
for (const d of ['fontok', 'kepek', 'js', 'vendor', 'email']) mkdirSync(join(KI, d), { recursive: true });

const brand = JSON.parse(readFileSync(join(KOD, 'shared/brand.json'), 'utf8'));
const { FEE_DEFAULTS } = await import(new URL('../shared/src/enums.ts', import.meta.url).href);
const M = await import(new URL('../shared/src/marketing.ts', import.meta.url).href);
// SPEC §31: public measurement settings (no secret): the Umami website id, the domains, DNT, the ad build switch
const MERES = JSON.parse(readFileSync(process.env.LANDING_MERES ? resolve(process.env.LANDING_MERES) : join(ITT, 'meres.json'), 'utf8'));
if (MERES.umamiWebsiteId && !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(MERES.umamiWebsiteId)) throw new Error('meres.json: az umamiWebsiteId UUID legyen (vagy üres).');
const STAT = Boolean(MERES.umamiWebsiteId);
const HIRDETES = MERES.hirdetes === true;
// the texts the lawyer reviews (kod/jogi/app_szovegek.json → szovegek.meres / lablec / suti_ablak)
const JOGI = JSON.parse(readFileSync(join(KOD, 'jogi/app_szovegek.json'), 'utf8')).szovegek;
const kell = (k) => {
  if (typeof JOGI[k] !== 'string' || !JOGI[k]) throw new Error(`app_szovegek.json: hiányzik ez a szöveg: ${k}`);
  return JOGI[k];
};
const MERES_SZ = { neMerjetek: kell('meres.ne_merjetek'), ujraMerheto: kell('meres.ujra_merheto'), kesz: kell('meres.ne_merjetek_kesz') };
const SUTI_LINK = kell('lablec.suti');
const SUTI_ABLAK = Object.fromEntries(['cim', 'szoveg', 'link_suti', 'link_adatkezeles', 'elfogadom', 'elutasitom', 'beallitasok', 'beallitasok_cim', 'beallitasok_bevezeto', 'szukseges', 'meta', 'google', 'mentes', 'mentve', 'lablec_link'].map((k) => [k, kell(`suti_ablak.${k}`)]));

// ---------- arak.json (generated, never hand-typed) ----------
const ARAK_SOROK = [
  ['havidij', 'Havidíj', 'hó', 'Minden benne van, amit az app tud.'],
  ['eves_zaras', 'Éves zárás', 'év', 'Az éves SZJA- és iparűzésiadó-bevallás.'],
  ['valtozas_egyszeru', 'Változás bejelentése helyetted', 'alkalom', 'Költözés, új tevékenység, telephely – ha mi jelentjük be.'],
  ['valtozas_jogallas', 'Jogállás-változás bejelentése helyetted', 'alkalom', 'Például főállásból mellékállásba.'],
  ['szuneteltetesi_dij', 'Amíg szünetel a vállalkozásod', 'hó', 'A havidíj helyett.'],
  ['megszuntetes', 'A vállalkozásod megszüntetése helyetted', 'alkalom', 'Ha magad jelented be az útmutatónkkal: 0 Ft.'],
];
const EGYSEG = { ho: 'hó', ev: 'év', alkalom: 'alkalom' };
for (const [kind, , egyseg] of ARAK_SOROK) {
  const f = FEE_DEFAULTS[kind];
  if (!f || !Number.isInteger(f.amountHuf)) throw new Error(`FEE_DEFAULTS: nincs ilyen díj: ${kind}`);
  if (f.confirmed !== true) throw new Error(`FEE_DEFAULTS.${kind}: nem megerősített ár nem kerülhet az oldalra`);
  if (EGYSEG[f.unit] !== egyseg) throw new Error(`FEE_DEFAULTS.${kind}: az egység (${f.unit}) nem egyezik az oldaléval (${egyseg})`);
}
const arak = {
  _megjegyzes: 'GENERÁLT a kod/shared FEE_DEFAULTS-ból (kod/landing/build.mjs) – ne írd át kézzel.',
  sorok: ARAK_SOROK.map(([kind, cim, egyseg, al]) => ({ kind, cim, osszegHuf: FEE_DEFAULTS[kind].amountHuf, egyseg, al })),
  magad: { cim: 'Ha magad jelented be (útmutatóval)', osszegHuf: 0 },
};
writeFileSync(join(ITT, 'arak.json'), JSON.stringify(arak, null, 2) + '\n', 'utf8');
const AR = Object.fromEntries(arak.sorok.map((s) => [s.kind, s]));

// ---------- helpers ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ftSz = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const ftNb = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, '&nbsp;');
const APP = 'https://app.adozz.hu';
const havidij = AR.havidij.osszegHuf;
const EV = M.MARKETING_EVENTS;
const ESEMENYEK = new Set(Object.values(EV));
const supportEmail = brand.provider.supportEmail ?? '';
if (!/^[^\s@[\]]+@[^\s@[\]]+\.[a-z]{2,}$/i.test(supportEmail)) throw new Error('brand.json: a provider.supportEmail nem valódi e-mail-cím (az oldal több helyen kiírja).');
// the template says „a {{ceg:legalName}}-vel kötöd”: the suffix is right for a „… Kft.” name only
if (!/ Kft\.$/.test(brand.provider.legalName)) throw new Error('brand.json: a legalName nem „… Kft.” – nézd át az oldal.sablon.html „-vel” toldalékát.');

// ---------- js/meres.js: the template + the shared channel rule (one definition, kod/shared/src/marketing.ts) ----------
const kozos = [
  `var SOURCE_ALIASES = ${JSON.stringify(M.SOURCE_ALIASES)};`,
  `var UTM_KEYS = ${JSON.stringify(M.UTM_KEYS)};`,
  `var AD_CLICK_ID_PARAMS = ${JSON.stringify(M.AD_CLICK_ID_PARAMS)};`,
  `var SOURCE_PARAM_REFERRER = ${JSON.stringify(M.SOURCE_PARAM_REFERRER)};`,
  `var SOURCE_PARAM_LANDING = ${JSON.stringify(M.SOURCE_PARAM_LANDING)};`,
  `var SOURCE_PARAM_CONSENT = ${JSON.stringify(M.SOURCE_PARAM_CONSENT)};`,
  // Node strips the TypeScript types to blanks; the function sources are plain JavaScript
  ...[M.normalizeDomain, M.endsWithDomain, M.domainChannel, M.isOwnDomain, M.channelOf, M.statisticsUrl].map((f) => f.toString().replace(/[ \t]{2,}/g, ' ')),
].join('\n');
const cfg = {
  app: APP,
  own: [...new Set(['adozz.hu', ...MERES.domains])],
  stat: STAT ? { websiteId: MERES.umamiWebsiteId, domains: MERES.domains.join(','), dnt: Boolean(MERES.doNotTrack) } : null,
  esemenyArak: EV.arak,
  szoveg: MERES_SZ,
  ...(HIRDETES ? { sutiAblak: SUTI_ABLAK, hirdetesLablec: 'A döntésedet egy sütiben (kj_hozzajarulas) jegyezzük meg; hirdetési sütit csak akkor használunk, ha elfogadod. A látogatottságot saját szerverünkön, süti nélkül mérjük.' } : {}),
};
let meresJs = readFileSync(join(ITT, 'meres-sablon.js'), 'utf8')
  .replace('/*__CFG__*/ {}', JSON.stringify(cfg))
  .replace('/*__SHARED__*/', kozos)
  .replace('/*__HIRDETES__*/', HIRDETES ? readFileSync(join(ITT, 'hirdetes-sablon.js'), 'utf8') : '// (ad measurement: not in this build – meres.json "hirdetes": false)');
if (/__CFG__|__SHARED__|__HIRDETES__/.test(meresJs)) throw new Error('meres.js: a sablon helyőrzője megmaradt.');
if (!HIRDETES && /connect\.facebook\.net|googletagmanager|fbq\(|gtag\(|hozzajarulas/.test(meresJs)) throw new Error('meres.js: hirdetési kód került a kikapcsolt buildbe.');
writeFileSync(join(KI, 'js', 'meres.js'), meresJs, 'utf8');
// the design's motion script, unchanged except its comments (no tracking, no storage, no request)
const mozgasJs = readFileSync(join(ITT, 'mozgas.js'), 'utf8');
if (/fetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|document\.cookie|eval\(|new Function/.test(mozgasJs)) throw new Error('mozgas.js: hálózati kérés, tárolás vagy eval nem lehet benne.');
const mozgasKi = jsMegjegyzesNelkul(mozgasJs);
new vm.Script(mozgasKi, { filename: 'mozgas.js' }); // compiles only (never runs): a syntax error stops the build
writeFileSync(join(KI, 'js', 'mozgas.js'), mozgasKi, 'utf8');
// the footer line: with the statistics the lawyer's text (meres.lablec); without them only the cookie fact. In the ad
// build meres.js replaces it only when the server answers { ads: true }.
const labSzoveg = STAT ? kell('meres.lablec') : 'Ez az oldal nem használ sütit.';
// „nincs követő süti” is true only while no ad code can be in the page (the statistics use no cookie)
const adatSutiMondat = HIRDETES ? 'Nem adjuk el az adataidat, és nem mutatunk hirdetést.' : 'Nem adjuk el az adataidat, nem mutatunk hirdetést, és nincs követő süti.';

// ---------- files: images, fonts, licences, the stylesheet, the e-mail logos ----------
const mappaMasol = (nev, kihagy = null) => {
  for (const f of readdirSync(join(ITT, nev))) if (statSync(join(ITT, nev, f)).isFile() && !(kihagy && kihagy.test(f))) copyFileSync(join(ITT, nev, f), join(KI, nev, f));
};
mappaMasol('kepek', /^LICENC_/); // the approved design's images (app screens with demo data, phone frame, logos, favicon); the phone frame's origin note (own drawing) stays in the source
mappaMasol('fontok'); // Geist (OFL-1.1), subset woff + full ttf
mappaMasol('vendor'); // licences of the open-source parts (LICENCEK.md)
copyFileSync(join(ITT, 'kepek', 'favicon.png'), join(KI, 'favicon.png')); // the old address /favicon.png keeps working
writeFileSync(join(KI, 'stilus.css'), cssMegjegyzesNelkul(readFileSync(join(ITT, 'stilus.css'), 'utf8')), 'utf8');
// E-mail-aláírás logója (tulaj 11-20): https://adozz.hu/email/logo_alairas@2x.png – a Lark aláírás erre hivatkozik, ne vesszen el.
copyFileSync(join(ITT, 'email/logo_alairas@2x.png'), join(KI, 'email', 'logo_alairas@2x.png'));
copyFileSync(join(ITT, 'email/logo_feher@2x.png'), join(KI, 'email', 'logo_feher@2x.png')); // rendszerlevelek fejléce (dizajn/email/sablon.html)

// ---------- index.html: the design template (markers of _eszkoz/epit.cjs + the data of this build) ----------
// Fluent Emoji Flat (MIT) – ikonok.json. Some drawings are not centred in their 32x32 box (getBBox, 11-21, the owner noticed the
// „Nyilvántartásba vett könyvelő” card icon sitting low): the viewBox is shifted to the drawing's centre (size unchanged).
const EMOJI = JSON.parse(readFileSync(join(ITT, 'ikonok.json'), 'utf8')).ikonok;
const KOZEPRE = { igazolvany: '0 5 32 32', kamera: '0 4.5 32 32', emberek: '0 2.96 32 32', cimke: '0.03 2.11 32 32', 'irat-toll': '2.1 0 32 32' };
function ikon(n) {
  if (!EMOJI[n]) throw new Error(`Nincs ilyen ikon az ikonok.json-ban: ${n} (node kod/landing/ikonok.mjs)`);
  let [vb, body] = EMOJI[n];
  if (KOZEPRE[n] && vb === '0 0 32 32') vb = KOZEPRE[n];
  body = body.replace(/id="([^"]+)"/g, (m, a) => `id="${n}-${a}"`).replace(/url\(#([^)]+)\)/g, (m, a) => `url(#${n}-${a})`);
  return `<svg class="ikon" viewBox="${vb}" aria-hidden="true" focusable="false">${body}</svg>`;
}
const LOGO = `<a class="logo" href="#top"><img src="kepek/logo.png" width="138" height="38" alt="${esc(brand.webName)} – az oldal teteje"></a>`;
const LOGO_FEJLEC = `<a class="logo logo-fejlec" href="#top"><img src="kepek/logo_feher.png" width="138" height="38" alt="${esc(brand.webName)} – az oldal teteje"></a>`; // kék fejlécen fehér logó (tulaj 11-21), nem lusta: a hajtás fölött van
const LOGO_FEHER = `<a class="logo logo-feher" href="#top"><img src="kepek/logo_feher.png" width="138" height="38" loading="lazy" alt="${esc(brand.webName)} – az oldal teteje"></a>`;
const PIPA = '<svg class="pipa" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M3.3 8.5l2.9 2.9 6.5-6.8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const NEM = '<svg class="pipa nem" viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 8h8" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>';

let html = readFileSync(join(ITT, 'oldal.sablon.html'), 'utf8').split('\r\n').join('\n');
html = html
  .replace(/<!--logo-fejlec-->/g, LOGO_FEJLEC)
  .replace(/<!--logo-feher-->/g, LOGO_FEHER)
  .replace(/<!--logo-->/g, LOGO)
  .replace(/<!--pipa-->/g, PIPA)
  .replace(/<!--nem-->/g, NEM)
  .replace(/<!--ikon:([a-z-]+)-->/g, (m, n) => ikon(n));
const maradtJelolo = html.match(/<!--(logo|pipa|nem|ikon:)[^>]*-->/g);
if (maradtJelolo) throw new Error('Kimaradt jelölő: ' + maradtJelolo.join(', '));
// the template's notes never reach the public page
html = html.replace(/[ \t]*<!--[\s\S]*?-->[ \t]*\n?/g, '').replace(/\n{3,}/g, '\n\n');
if (/<!--/.test(html)) throw new Error('Maradt HTML-megjegyzés a kimenetben');

const ERTEK = {
  app: APP,
  web_nev: esc(brand.webName),
  email: esc(supportEmail),
  ev: String(new Date().getFullYear()),
  ev_osszesen: ftNb(havidij * 12 + AR.eves_zaras.osszegHuf),
  suti_link: esc(SUTI_LINK),
  meres_lablec: esc(labSzoveg),
  suti_beallitasok_gomb: HIRDETES ? ` <button type="button" class="szoveg-gomb" id="suti-beallitasok" hidden>${esc(SUTI_ABLAK.lablec_link)}</button>` : '',
  adat_suti_mondat: esc(adatSutiMondat),
};
const CEG = ['legalName', 'seat', 'taxNumber', 'registryNumber'];
html = html.replace(/\{\{([a-z_]+)(?::([A-Za-z_-]+))?(?::([a-z]+))?\}\}/g, (m, k, a, b) => {
  if (k === 'ar' || k === 'ar_sz' || k === 'egyseg') {
    if (!AR[a]) throw new Error(`Ismeretlen díj a sablonban: ${m}`);
    return k === 'ar' ? ftNb(AR[a].osszegHuf) : k === 'ar_sz' ? ftSz(AR[a].osszegHuf) : esc(AR[a].egyseg);
  }
  if (k === 'ceg') {
    if (!CEG.includes(a) || !brand.provider[a]) throw new Error(`Ismeretlen cégadat a sablonban: ${m}`);
    return esc(brand.provider[a]);
  }
  if (k === 'esemeny') {
    // SPEC §31: the click events (meres.js sends them without holding the link); hely = where the button is
    if (!ESEMENYEK.has(a) || !b) throw new Error(`Ismeretlen esemény a sablonban: ${m}`);
    return ` data-kj-esemeny="${a}" data-kj-hely="${b}"`;
  }
  if (a || !(k in ERTEK)) throw new Error(`Ismeretlen jelölő a sablonban: ${m}`);
  return ERTEK[k];
});
if (/\{\{|\}\}/.test(html)) throw new Error('Kitöltetlen jelölő maradt: ' + html.match(/.{0,40}(\{\{|\}\}).{0,40}/)[0]);

// ---------- the page rules, checked on the output (CSP default-src 'self'; script-src 'self'; style-src 'self') ----------
const hibak = [];
if (/\sstyle=/i.test(html) || /<style/i.test(html)) hibak.push('inline stílus');
if (/<script(?![^>]*\ssrc="js\/[a-z]+\.js")[^>]*>/i.test(html)) hibak.push('inline vagy idegen szkript');
if (/\son[a-z]+\s*=/i.test(html)) hibak.push('inline eseménykezelő');
if (/\s(src|srcset|poster)="[^"]*(https?:)?\/\//i.test(html) || /<link[^>]+href="(https?:)?\/\//i.test(html)) hibak.push('idegen szerverről betöltött fájl');
if (/\bAI\b|mesterséges intelligencia/i.test(html)) hibak.push('AI-említés');
if (!html.includes('A csapatunk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között.')) hibak.push('hiányzik a visszahívás engedélyezett mondata');
if (!html.includes(`href="${APP}/regisztracio?cel=visszahivas" data-kj-esemeny="${EV.visszahivas}"`)) hibak.push('hiányzik a „Visszahívást kérek” link');
if (!html.includes(`href="${APP}/jogi/suti"`) || !html.includes(`href="${APP}/jogi/aszf"`) || !html.includes(`href="${APP}/jogi/adatkezeles"`)) hibak.push('hiányzik egy jogi link');
if (!/<section[^>]*\bid="arak"/.test(html)) hibak.push('nincs id="arak" szakasz (görgetés-esemény)');
const css = readFileSync(join(KI, 'stilus.css'), 'utf8');
if (/@import|url\(\s*["']?(https?:)?\/\//i.test(css)) hibak.push('a stilus.css idegen fájlt tölt be');
// every local file the page and the stylesheet point to must be in the build
const hivatkozasok = new Set();
for (const m of html.matchAll(/\s(?:src|href)="([^"#:?]+)"/g)) hivatkozasok.add(m[1]);
for (const m of html.matchAll(/\ssrcset="([^"]+)"/g)) for (const r of m[1].split(',')) hivatkozasok.add(r.trim().split(/\s+/)[0]);
for (const m of css.matchAll(/url\(\s*["']?([^"')]+)["']?\s*\)/g)) if (!m[1].startsWith('data:')) hivatkozasok.add(m[1]);
for (const h of hivatkozasok) if (!existsSync(join(KI, h))) hibak.push(`hiányzó fájl: ${h}`);
if (hibak.length) throw new Error('landing: ' + hibak.join('; '));

writeFileSync(join(KI, 'index.html'), html, 'utf8');

// ---------- every public text file: no AI mention, no working note (the build above wrote all of them) ----------
const BELSO = [
  [/\bAI\b|mesterséges intelligencia|\bMI-vel\b/i, 'AI-említés'],
  [/\btulaj(?!don)/i, 'belső jegyzet (tulaj)'],
  [/_eszkoz|C5_v2|epit\.cjs|scratchpad|Kovács Bence|_munka\//, 'belső út vagy demónév'],
];
const fajlok = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? fajlok(join(d, f)) : [join(d, f)]));
for (const f of fajlok(KI)) {
  const rel = relative(KI, f).split('\\').join('/');
  if (/^kepek\/LICENC_/.test(rel)) hibak.push(`régi fájl maradt a kimenetben: ${rel} (költöztesd a _regi-be)`);
  if (!/\.(html|css|js|md|txt|json|svg)$/i.test(f)) continue;
  const sz = readFileSync(f, 'utf8');
  for (const [re, mi] of BELSO) if (re.test(sz)) hibak.push(`${mi}: ${rel} („${sz.match(re)[0]}”)`);
  if (/\.(css|js)$/.test(f) && rel !== 'js/meres.js' && /\/\*/.test(sz)) hibak.push(`megjegyzés maradt: ${rel}`);
}
if (hibak.length) throw new Error('landing (kimenet): ' + hibak.join('; '));
console.log(`landing -> ${KI} (havidíj ${havidij} Ft, ${arak.sorok.length} ár; statisztika: ${STAT ? 'be' : 'ki'}, hirdetési kód: ${HIRDETES ? 'BENT' : 'nincs'}; ${hivatkozasok.size} helyi fájl ellenőrizve)`);
