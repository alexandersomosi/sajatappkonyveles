#!/usr/bin/env node
// SPEC §29.3.6 – the adozz.hu landing page: static HTML + CSS, no cookie. SPEC §31 (2026-11-20): one own script
// (js/meres.js, generated below from kod/shared/src/marketing.ts) passes the source to the app links and – when meres.json
// has the website id – loads our own cookie-less statistics script (Umami, /m/script.js) ITSELF, after its filter is set
// (so the statistics never run without the filter). The button events are sent by meres.js without waiting (no
// data-umami-event: the Umami tracker would hold the navigation until its request ends). The visible texts of the footer
// switch and of the cookie banner come from kod/jogi/app_szovegek.json (the lawyer's copy). The ad code and the banner are
// in the page only with "hirdetes": true (and then still only run with the server switch on).
// Prices come from ONE generated file (arak.json, made here from FEE_DEFAULTS of kod/shared – no hand-typed prices);
// the company data from kod/shared/brand.json. Output: kod/landing/dist/ (what feltolt.sh uploads to /srv/kezjegy/web/landing).
//   node kod/landing/build.mjs          (Node ≥ 23: reads the shared .ts with type stripping)
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ITT = dirname(fileURLToPath(import.meta.url));
const KOD = resolve(ITT, '..');
// LANDING_KI / LANDING_MERES: only for the tests (meres.test.mjs builds the ad variant into a temporary folder)
const KI = process.env.LANDING_KI ? resolve(process.env.LANDING_KI) : join(ITT, 'dist');
mkdirSync(join(KI, 'fonts'), { recursive: true });
mkdirSync(join(KI, 'kepek'), { recursive: true });

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
];
const arak = {
  _megjegyzes: 'GENERÁLT a kod/shared FEE_DEFAULTS-ból (kod/landing/build.mjs) – ne írd át kézzel.',
  sorok: ARAK_SOROK.map(([kind, cim, egyseg, al]) => ({ kind, cim, osszegHuf: FEE_DEFAULTS[kind].amountHuf, egyseg, al })),
  magad: { cim: 'Ha magad jelented be (útmutatóval)', osszegHuf: 0 },
};
writeFileSync(join(ITT, 'arak.json'), JSON.stringify(arak, null, 2) + '\n', 'utf8');

// ---------- helpers ----------
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ft = (n) => String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const APP = 'https://app.adozz.hu';
const havidij = arak.sorok.find((s) => s.kind === 'havidij').osszegHuf;
const supportHelyorzo = /^\[CÉGADAT/.test(brand.provider.supportEmail ?? '');
const EV = M.MARKETING_EVENTS;
/** The click events of the page: meres.js sends them to the statistics without holding the navigation. */
const esemeny = (nev, hely) => ` data-kj-esemeny="${nev}"${hely ? ` data-kj-hely="${hely}"` : ''}`;

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
mkdirSync(join(KI, 'js'), { recursive: true });
writeFileSync(join(KI, 'js', 'meres.js'), meresJs, 'utf8');
// the footer line: with the statistics the lawyer's text (meres.lablec); without them only the cookie fact. In the ad
// build meres.js replaces it only when the server answers { ads: true }.
const labSzoveg = STAT ? kell('meres.lablec') : 'Ez az oldal nem használ sütit.';

// fonts (Geist from the app) and the few images (3D objects of the approved set, the mark)
for (const s of [400, 600, 650, 700]) copyFileSync(join(KOD, `app/assets/fonts/Geist-W${s}.ttf`), join(KI, 'fonts', `Geist-W${s}.ttf`));
copyFileSync(join(KOD, 'app/assets/fonts/OFL.txt'), join(KI, 'fonts', 'OFL.txt'));
const KEPEK = ['fiok_28@2x', 'szamolo_28@2x', 'szamlak_28@2x', 'hataridok_28@2x', 'uzenetek_28@2x', 'bevallas_28@2x', 'tepnaptar_28@2x', 'szamlaszam_28@2x', 'kerdezek_28@2x'];
for (const k of KEPEK) copyFileSync(join(KOD, `app/assets/ikon3d/${k}.png`), join(KI, 'kepek', `${k.replace('@2x', '')}.png`));
copyFileSync(join(KOD, 'app/assets/icon.png'), join(KI, 'kepek', 'jel.png'));
copyFileSync(join(KOD, 'app/assets/textura/rozetta@2x.png'), join(KI, 'kepek', 'rozetta.png'));
copyFileSync(join(KOD, 'app/assets/favicon.png'), join(KI, 'favicon.png'));
copyFileSync(join(ITT, 'stilus.css'), join(KI, 'stilus.css'));
// E-mail-aláírás logója (tulaj 11-20): https://adozz.hu/email/logo_alairas@2x.png – a Lark aláírás erre hivatkozik, ne vesszen el.
mkdirSync(join(KI, 'email'), { recursive: true });
copyFileSync(join(ITT, 'email/logo_alairas@2x.png'), join(KI, 'email', 'logo_alairas@2x.png'));
copyFileSync(join(ITT, 'email/logo_feher@2x.png'), join(KI, 'email', 'logo_feher@2x.png')); // rendszerlevelek fejléce (dizajn/email/sablon.html)

const ikon = (k) => `<img class="i3" src="kepek/${k}_28.png" width="28" height="28" alt="">`;
const MIT = [
  ['fiok', 'Saját könyvelő, név szerint', 'Neki írsz az appban, és ő ad be mindent a NAV-nál helyetted.'],
  ['szamolo', 'Kiszámolja és beadja az adódat', 'Negyedévente megmondja, mennyit és melyik számlára utalj.'],
  ['szamlak', 'A kiállított számláid maguktól bejönnek', 'Naponta letöltjük őket a NAV Online Számla rendszeréből.'],
  ['hataridok', 'Emlékeztetők a határidőkre', 'Az appban és, ha kéred, a saját naptáradban is.'],
  ['szamlaszam', 'Mennyit tegyél félre', 'Minden számlánál látod, mennyit tegyél félre az adóra.'],
  ['uzenetek', 'Üzenet a könyvelődnek', 'Kérdezz bármikor, az appban válaszol.'],
];
const LEPESEK = [
  'Regisztrálsz, és válaszolsz pár kérdésre.',
  'Aláírod a szerződést, és engedélyt adsz a NAV-nál.',
  'Megadod a kártyádat – az első hónapot ekkor fizeted.',
  'A könyvelőd bekapcsolja a könyvelést.',
];

const html = `<!doctype html>
<html lang="hu">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(brand.name)} – ${esc(brand.tagline.replace(/\.$/, ''))}</title>
<meta name="description" content="Saját könyvelő átalányadós és katás egyéni vállalkozóknak. Havi ${ft(havidij)} Ft, minden benne van.">
<link rel="icon" href="favicon.png">
<link rel="stylesheet" href="stilus.css">
<script defer src="js/meres.js"></script>
</head>
<body>
<header class="sav">
  <div class="belso">
    <div class="marka"><img src="kepek/jel.png" width="44" height="44" alt=""><span>${esc(brand.name)}</span></div>
    <h1>${esc(brand.tagline)}</h1>
    <p class="al">Átalányadós és katás egyéni vállalkozóknak. Havi ${ft(havidij)}&nbsp;Ft, minden benne van.</p>
    <div class="gombok">
      <a class="gomb-e" href="${APP}/regisztracio"${esemeny(EV.regisztralok, 'hos')}>Regisztrálok</a>
      <a class="kapszula-sav" href="${APP}/belepes"${esemeny(EV.belepes, 'hos')}>Belépés</a>
    </div>
    <p class="kicsi">Az első hónapot a kártyád megadásakor fizeted. Bármikor lemondhatod.</p>
  </div>
</header>
<main>
  <section class="szak">
    <div class="belso">
      <div class="szak-fej">${ikon('bevallas')}<h2>Mit kapsz?</h2></div>
      <ul class="lista">
${MIT.map(([k, c, a]) => `        <li>${ikon(k)}<div><b>${esc(c)}</b><span>${esc(a)}</span></div></li>`).join('\n')}
      </ul>
    </div>
  </section>
  <section class="szak">
    <div class="belso">
      <div class="szak-fej">${ikon('tepnaptar')}<h2>Így indulsz</h2></div>
      <ol class="lepesek">
${LEPESEK.map((l, i) => `        <li><span class="szam">${i + 1}</span><span>${esc(l)}</span></li>`).join('\n')}
      </ol>
      <p class="beljebb halvany">Ha még nincs vállalkozásod, lépésről lépésre segítünk elindítani – vagy intézzük helyetted.</p>
    </div>
  </section>
  <section class="szak" id="arak">
    <div class="belso">
      <div class="szak-fej">${ikon('szamolo')}<h2>Mennyibe kerül?</h2></div>
      <table class="arak">
        <tbody>
${arak.sorok.map((s) => `          <tr><th scope="row">${esc(s.cim)}<span>${esc(s.al)}</span></th><td>${ft(s.osszegHuf)}&nbsp;Ft<span>/ ${esc(s.egyseg)}</span></td></tr>`).join('\n')}
          <tr><th scope="row">${esc(arak.magad.cim)}<span>A változás-útmutatóinkkal.</span></th><td>0&nbsp;Ft</td></tr>
        </tbody>
      </table>
      <p class="beljebb">Minden ár bruttó, 27% ÁFA-val. Bármikor lemondhatod: a kifizetett hónap végéig minden marad.</p>
      <div class="beljebb"><a class="gomb-e" href="${APP}/regisztracio"${esemeny(EV.regisztralok, 'arak')}>Regisztrálok</a></div>
    </div>
  </section>
  <section class="szak">
    <div class="belso">
      <div class="szak-fej">${ikon('kerdezek')}<h2>Ha kérdésed van</h2></div>
      <p class="beljebb">${supportHelyorzo ? 'Ügyfélszolgálat: az appban, az Üzenetek fülön.' : `Írj nekünk: <a href="mailto:${esc(brand.provider.supportEmail)}"${esemeny(EV.email)}>${esc(brand.provider.supportEmail)}</a>`}</p>
      <p class="beljebb">Inkább beszélnél valakivel? Regisztrálj, és kérj visszahívást. A csapatunk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között.</p>
      <div class="beljebb"><a class="kapszula" href="${APP}/regisztracio?cel=visszahivas"${esemeny(EV.visszahivas, 'kerdes')}>Visszahívást kérek</a></div>
    </div>
  </section>
</main>
<footer class="lab">
  <div class="belso">
    <p><b>${esc(brand.provider.legalName)}</b> · ${esc(brand.provider.seat)}</p>
    <p>Adószám: <span class="nw">${esc(brand.provider.taxNumber)}</span> · Cégjegyzékszám: <span class="nw">${esc(brand.provider.registryNumber)}</span></p>
    <p><a href="${APP}/jogi/aszf">ÁSZF</a> · <a href="${APP}/jogi/adatkezeles">Adatkezelés</a> · <a href="${APP}/jogi/suti">${esc(SUTI_LINK)}</a></p>
    <p class="halvany" id="meres-lablec">${esc(labSzoveg)}</p>
    <p><button type="button" class="szoveg-gomb" id="meres-kapcsolo" hidden></button>${HIRDETES ? ` <button type="button" class="szoveg-gomb" id="suti-beallitasok" hidden>${esc(SUTI_ABLAK.lablec_link)}</button>` : ''} <span class="halvany" id="meres-visszajelzes" role="status" aria-live="polite"></span></p>
  </div>
</footer>
</body>
</html>
`;
writeFileSync(join(KI, 'index.html'), html, 'utf8');
console.log(`landing -> ${KI} (havidíj ${havidij} Ft, ${arak.sorok.length} ár; statisztika: ${STAT ? 'be' : 'ki'}, hirdetési kód: ${HIRDETES ? 'BENT' : 'nincs'})`);
