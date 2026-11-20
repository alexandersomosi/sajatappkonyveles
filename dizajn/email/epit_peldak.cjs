// A sablonból legyártja a hat példalevelet. A beépítésnél ugyanezt a töltést kell a backendben megírni.
const fs = require('fs'), path = require('path');
const D = __dirname;
const brand = JSON.parse(fs.readFileSync(path.resolve(D, '../../kod/shared/brand.json'), 'utf8'));
const F = "-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif";
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Magyar tipográfia: az „a”/„az” névelő ne maradjon a sor végén, és a szám ne váljon el a mértékegységtől (nem törő szóköz).
const ty = t => String(t).replace(/(^|[\s(>])([Aa]z?) /g, '$1$2 ').replace(/(\d) (?=óra|órán|percig|Ft)/g, '$1 ');

// Térköz a blokkok körül: cellapadding (a táblázat-margót az Outlook nem mindig veszi figyelembe).
const blokk = (pad, belso) => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td style="padding:${pad};">${belso}</td></tr></table>`;

// ---- építőelemek ----
const E = {
  p: t => `<p style="margin:0 0 16px 0;font-family:${F};font-size:16px;line-height:25px;mso-line-height-rule:exactly;color:#10152B;">${ty(t)}</p>`,
  kicsi: t => `<p style="margin:0 0 16px 0;font-family:${F};font-size:14px;line-height:22px;mso-line-height-rule:exactly;color:#5B6478;">${ty(t)}</p>`,
  kod: k => blokk('4px 0 20px 0', `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td align="center" bgcolor="#F3F5FB" style="background-color:#F3F5FB;border:1px solid #ECEFF6;border-radius:12px;padding:18px 12px;"><div class="kod" style="font-family:${F};font-size:36px;line-height:44px;mso-line-height-rule:exactly;font-weight:700;letter-spacing:6px;color:#1428DB;padding-left:6px;">${k}</div></td></tr></table>`),
  kv: sorok => blokk('4px 0 20px 0', `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="border-top:1px solid #ECEFF6;">${sorok.map(([k, v, kiemel]) => `<tr><td class="kv-kulcs" valign="top" style="padding:11px 12px 11px 0;border-bottom:1px solid #ECEFF6;font-family:${F};font-size:14px;line-height:21px;mso-line-height-rule:exactly;color:#5B6478;width:38%;">${k}</td><td class="kv-ertek" valign="top" align="right" style="padding:11px 0;border-bottom:1px solid #ECEFF6;font-family:${F};font-size:${kiemel ? 18 : 15}px;line-height:21px;mso-line-height-rule:exactly;font-weight:${kiemel ? 700 : 600};color:#10152B;text-align:right;">${v}</td></tr>`).join('')}</table>`),
  tipp: t => blokk('4px 0 20px 0', `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#FFF6DB" style="background-color:#FFF6DB;border-left:4px solid #FFC93C;border-radius:8px;padding:14px 16px;font-family:${F};font-size:14px;line-height:22px;mso-line-height-rule:exactly;color:#10152B;"><strong>Tipp:</strong> ${ty(t)}</td></tr></table>`),
  info: t => blokk('4px 0 20px 0', `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr><td bgcolor="#EAEDFC" style="background-color:#EAEDFC;border-left:4px solid #1428DB;border-radius:8px;padding:14px 16px;font-family:${F};font-size:14px;line-height:22px;mso-line-height-rule:exactly;color:#10152B;">${ty(t)}</td></tr></table>`),
  // másodlagos link a tartalmon belül: önálló sor, kék, aláhúzott, 14 px (ugyanaz a stílus, mint a sablon gomb alatti {{#link}} blokkjáé)
  link: (t, h) => `<p style="margin:0 0 16px 0;font-family:${F};font-size:14px;line-height:22px;mso-line-height-rule:exactly;"><a href="${h}" style="color:#1428DB;text-decoration:underline;">${ty(t)}</a></p>`,
  // szövegen belüli link (pl. e-mail-cím egy mondatban)
  a: (t, h) => `<a href="${h}" style="color:#1428DB;text-decoration:underline;">${t}</a>`,
  // ne törjön szét (pl. „Fiók → Díjak és számlák”)
  egyben: t => `<span style="white-space:nowrap;">${t}</span>`,
};
const OK_FIOK = 'Ezt a levelet azért kaptad, mert az Adózz.hu-n van fiókod.';
const sablon = fs.readFileSync(path.join(D, 'sablon.html'), 'utf8');
function tolt(v) {
  let h = sablon;
  // elhagyható blokkok: ha nincs adat, a blokk kimarad, különben csak a jelölők tűnnek el
  const blokkja = (nev, van) => { h = h.replace(new RegExp(String.raw`\{\{#${nev}\}\}([\s\S]*?)\{\{/${nev}\}\}`), van ? '$1' : ''); };
  blokkja('gomb', !!v.gomb_szoveg);
  blokkja('link', !!v.link_szoveg);
  const m = { elonezet: esc(v.elonezet), cim: esc(ty(v.cim)), gomb_szoveg: esc(v.gomb_szoveg || ''), gomb_link: esc(v.gomb_link || ''),
    link_szoveg: esc(ty(v.link_szoveg || '')), link_cel: esc(v.link_cel || ''), lablec_ok: esc(ty(v.lablec_ok)), tartalom: v.tartalom };
  for (const k in m) h = h.split(`{{${k}}}`).join(m[k]);
  return h;
}
const NB = ' '; // nem törő szóköz
const L = [
  ['01_belepesi_kod', { elonezet: 'A kód 10 percig érvényes.', cim: 'A belépési kódod',
    lablec_ok: 'Ezt a levelet azért kaptad, mert ezzel az e-mail-címmel belépési kódot kértek az Adózz.hu-n.',
    tartalom: E.p('Szia Péter!') + E.p('Ezzel a kóddal tudsz belépni az Adózz.hu-ra:') + E.kod('482&nbsp;913') + E.p('A kód 10 percig érvényes.')
      + E.kicsi('Ha nem te kérted, nyugodtan hagyd figyelmen kívül ezt a levelet. A kódot senkinek ne add meg.') }],
  ['02_jelszo_visszaallitas', { elonezet: 'Ezzel a kóddal állíthatsz be új jelszót. 10 percig érvényes.', cim: 'A jelszó-visszaállító kódod',
    lablec_ok: 'Ezt a levelet azért kaptad, mert ehhez az e-mail-címhez új jelszót kértek az Adózz.hu-n.',
    tartalom: E.p('Szia Péter!') + E.p('Ezzel a kóddal tudsz új jelszót beállítani:') + E.kod('715&nbsp;306') + E.p('A kód 10 percig érvényes.')
      + E.kicsi('Ha nem te kérted, hagyd figyelmen kívül ezt a levelet, a jelszavad nem változik. A kódot senkinek ne add meg.') }],
  ['03_dijszamla', { elonezet: '19 999 Ft, kártyával fizetve. A PDF-et csatoltuk.', cim: 'Számla a havidíjról', lablec_ok: OK_FIOK,
    gomb_szoveg: 'Letöltöm a számlát', gomb_link: 'https://adozz.hu/fiok/dijak',
    link_szoveg: 'Az összes számlád: Fiók → Díjak és számlák', link_cel: 'https://adozz.hu/fiok/dijak',
    tartalom: E.p('Szia Péter!') + E.p('Elkészült a havidíjad számlája ' + E.egyben('(2026. 11. 20. – 12. 19.).'))
      + E.kv([['Összeg', '19 999 Ft', 1], ['Számlaszám', 'ADZ-2026-001482'], ['Fizetés', 'Kártyával fizetve']])
      + E.kicsi('A számla PDF-je csatolva is van ehhez a levélhez.') }],
  ['04_dijbekero_atutalas', { elonezet: '19 999 Ft, fizetési határidő: 2026. 11. 28.', cim: 'Díjbekérő a havidíjról', lablec_ok: OK_FIOK,
    gomb_szoveg: 'Letöltöm a díjbekérőt', gomb_link: 'https://adozz.hu/fiok/dijak',
    tartalom: E.p('Szia Péter!') + E.p('Itt vannak a havidíjad utalási adatai:')
      + E.kv([['Összeg', '19 999 Ft', 1], ['Határidő', '2026. 11. 28.'], ['Kedvezményezett', brand.provider.legalName], ['Számlaszám', brand.provider.bankAccount], ['Közlemény', 'ADZ-10482']])
      + E.p('A közleményt pontosan így írd be, ebből tudjuk, hogy a te utalásod érkezett.')
      + E.tipp('állíts be állandó átutalást a netbankodban, így havonta nem kell rá gondolnod.')
      + E.kicsi('A díjbekérő PDF-je csatolva is van ehhez a levélhez.') }],
  ['05_hatarido_emlekezteto', { elonezet: 'A IV. negyedévre kb. 154 000 Ft-ot kell befizetned.', cim: `Január 12-ig utald el a IV.${NB}negyedévi adót`, lablec_ok: OK_FIOK,
    gomb_szoveg: 'Megnézem az utalási adatokat', gomb_link: 'https://adozz.hu/ado/negyedeves',
    tartalom: E.p('Szia Péter!') + E.p('Közeleg a negyedéves befizetés. Az ' + E.egyben('október–decemberi') + ' bevételeid után nagyjából ennyit kell utalnod:')
      + E.kv([['Szja-előleg', '41 000 Ft'], ['TB-járulék', '86 000 Ft'], ['Szociális hozzájárulási adó', '27 000 Ft'], ['Összesen (kb.)', '154 000 Ft', 1], ['Határidő', '2027. 01. 12.']])
      + E.info('Ezek becsült összegek a rögzített bevételeid alapján. A pontos utalási adatokat az appban találod.') }],
  ['06_visszahivas', { elonezet: 'Megkaptuk a visszahívás-kérésedet.', cim: 'Megkaptuk a kérésedet',
    lablec_ok: 'Ezt a levelet azért kaptad, mert visszahívást kértél tőlünk.',
    tartalom: E.p('Szia Péter!') + E.p('Köszönjük, hogy szóltál! A csapatunk ' + E.egyben('24–48 órán') + ' belül visszahív, munkanapokon 9 és 17 óra között.')
      + E.kv([['Telefonszám', '+36 30 123 4567'], ['Téma', 'Számlázási kérdés']])
      + E.kicsi('Ha másik számon hívjunk, írd meg nekünk: ' + E.a('ugyfelszolgalat@adozz.hu', 'mailto:ugyfelszolgalat@adozz.hu')) }],
];
for (const [n, v] of L) fs.writeFileSync(path.join(D, n + '.html'), tolt(v));
console.log(L.length, 'levél kész');
