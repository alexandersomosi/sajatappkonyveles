// Tartalmi szabályok a jogi szövegekre (SPEC §26 + §27, tulaj-kérések 11-18 és 11-19). Az `npm run ellenoriz` és a
// tesztek is ezt hívják.
//
// - SPEC §27 (11-19): a vállalkozás bejelentését a könyvelő a KÉRÉSRE, meghatalmazottként, az ügyfél utasítása szerint
//   beküldheti („Intézzük helyetted”). Tilos viszont feltétel nélkül azt állítani, hogy „mi bejelentjük”, hogy a csapat
//   (ügyfélszolgálat) küld be bármit, és a „bejegyeztetjük”, „ügyintézési díj”, „jogi képviselet” kifejezés.
// - Időpontot foglalni már nem lehet: csak a megszűnésről vagy a korábbi foglalásokról szólhat szöveg (O2.5).
// - A lakcímkártya személyi azonosítós oldalát soha nem kérjük (Pmt. 7. § (8), O7.4).
// - Nincs „AI” / mesterséges intelligencia a nyilvános szövegekben; tegezünk.
// - Nincs „anyád” / „édesanyád” (az appban „anyukád”, a jogi szövegben „anyja születési neve”) – SPEC §27.0.2/5.
// - A kiállított számlákról egy megfogalmazás: soha „a NAV-tól jön/jött számla” (SPEC §27.5, INVOICE_WORDING_FORBIDDEN_PATTERNS).
// - A belépést soha nem kérjük el: az ÁSZF, az adatkezelési tájékoztató, a szerződés, a meghatalmazás-leírás és a GYIK ki is mondja.
// - A push-értesítés szövegében nincs összeg, telefonszám, adószám (SPEC §26.11, §27.8).
// - A „tartalom” blokk kulcsai a SPEC §26–§27 tartalomkulcsai (content_texts).

import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { NOTIFICATION_KINDS } from './_shared/enums.js';
import { ASSIST_TEXTS, INVOICE_WORDING_FORBIDDEN_PATTERNS } from './_shared/bekotes.js';
import { betoltIndex, betoltSablonok, CSOMAG_GYOKER, type AppSzovegek } from './jogi.js';

/**
 * SPEC §26.2.7 + §27.10 – ezek a kérdések szó szerint kellenek (a backend az élő adatbázisban a kérdés szövege alapján
 * keres; a 11-19-én átnevezett kérdés régi szövege az `elozo_kerdes` mezőben van).
 */
export const UJ_GYIK_KERDESEK = [
  'Hogyan kérhetek visszahívást?',
  'Még nincs vállalkozásom. Mit tegyek?',
  'Bejelentitek helyettem a vállalkozásomat?',
  'Mikor kezdődik a havidíj, ha most indítom a vállalkozásomat?',
  'Mit jelent, hogy jóvá kell hagynom a meghatalmazást?',
] as const;
export const GYIK_DARAB = 13;

/** SPEC §26.2.2 – a visszahívási űrlap adatkezelési mondata (jogi szöveg; hozzájárulás-pipa nincs). */
export const VISSZAHIVAS_ADATKEZELES =
  'A megadott számon ezzel a kéréssel kapcsolatban hívunk. A hívásról rövid jegyzetet írunk, a hívást nem rögzítjük. Részletek az Adatkezelési tájékoztatóban.';

/** SPEC §26.11 + §27.8 – ezek a fajták mehetnek push-értesítésben is (a változatukkal együtt). */
export const PUSH_FAJTAK = [
  'callback_calling',
  'callback_missed',
  'callback_wrong_number',
  'callback_unreached',
  'registration_reminder',
  'registration_needs_fix',
  'registration_checked',
  'registration_done',
  'message_new',
  'assist_started',
  'assist_mh_filed',
  'assist_mh_reminder',
  'assist_mh_expired',
  'assist_consent_needed',
  'assist_ev_filed',
  'kamara_reminder',
] as const;

/** Mondatokra bontás: pont/kérdőjel/felkiáltójel után akkor új mondat, ha nagybetű vagy idézőjel jön (a „2026. november” nem bomlik). */
export function mondatok(szoveg: string): string[] {
  return szoveg
    .replace(/\*\*/g, '')
    .split(/\n+|(?<=[.!?])\s+(?=[A-ZÁÉÍÓÖŐÚÜŰ„"(])/u)
    .map((s) => s.trim())
    .filter(Boolean);
}

const VAN_NEM = /(^|[^\p{L}])(nem|ne|sem|soha)([^\p{L}]|$)/iu;

/**
 * Igaz, ha a mondat feltétel nélkül azt állítja, hogy MI jelentjük be / küldjük be a vállalkozást az ügyfél helyett.
 * SPEC §27: megengedett, ha a mondat a meghatalmazottat ÉS az ügyfél kérését / utasítását / engedélyét is megnevezi
 * („ha kéred, a könyvelőd meghatalmazottként, az utasításod szerint…”), és a későbbi változások bejelentése is.
 */
export function bejelentesAllitas(mondat: string): boolean {
  const ige = /(^|[^\p{L}])(bejelentjük|beküldjük|benyújtjuk|(jelentjük|küldjük|nyújtjuk) be)([^\p{L}]|$)/iu;
  const targy = /(vállalkozásod|vállalkozásodat|bejelentésed|bejelentésedet|helyetted|a nevedben|kezdést)/iu;
  // „intézzük” csak a bejelentéssel együtt gyanús („a könyvelésedet intézzük” rendben van); az idézőjeles
  // szolgáltatásnév („Intézzük helyetted”) nem állítás
  const nevNelkul = mondat.replace(/„[^”]*”/gu, '');
  const intezes = /(^|[^\p{L}])intézzük([^\p{L}]|$)/iu.test(nevNelkul) && /bejelentés/iu.test(nevNelkul);
  if (!(ige.test(mondat) && targy.test(mondat)) && !intezes) return false;
  if (VAN_NEM.test(mondat)) return false;
  // a későbbi változások bejelentése a meghatalmazás alapján megengedett (SPEC §26.6.3)
  if (/változás/iu.test(mondat)) return false;
  // SPEC §27.3: kérésre / utasításra, a könyvelő mint meghatalmazott jár el
  if (/(meghatalmazott|könyvelőd)/iu.test(mondat) && /(kér(ed|ésedre|ésre|d)|utasítás|engedély|engedélyez)/iu.test(mondat)) return false;
  return true;
}

/** Igaz, ha a mondat szerint a csapat / ügyfélszolgálat küld be valamit a NAV-nak (SPEC §27.3.4: soha). */
export function csapatBekuld(mondat: string): boolean {
  if (!/(csapat|ügyfélszolgálat)/iu.test(mondat)) return false;
  if (!/(^|[^\p{L}])(bejelenti|beküldi|benyújtja|bejelentik|beküldik|benyújtják)([^\p{L}]|$)/iu.test(mondat)) return false;
  return !VAN_NEM.test(mondat);
}

/** A segített útnál tiltott nyilvános kifejezés (SPEC §27.10): „bejegyeztetjük”, „ügyintézési díj”, nem tagadott „jogi képviselet”. */
export function tiltottKifejezes(mondat: string): string | null {
  if (/bejegyeztet/iu.test(mondat)) return 'bejegyeztet…';
  if (/ügyintézési\s+díj/iu.test(mondat)) return 'ügyintézési díj';
  if (/jogi\s+képviselet/iu.test(mondat) && !VAN_NEM.test(mondat)) return 'jogi képviselet';
  return null;
}

/** „anyád” / „édesanyád” – az appban „anyukád”, a jogi szövegben „anyja (születési) neve” (SPEC §27.0.2/5). */
export function anyadSzo(szoveg: string): boolean {
  return /(^|[^\p{L}])(édes)?anyád/iu.test(szoveg);
}

/** A kiállított számlák tiltott megfogalmazása (SPEC §27.5.4): a shared INVOICE_WORDING_FORBIDDEN_PATTERNS találata. */
export function szamlaTiltott(szoveg: string): string | null {
  for (const p of INVOICE_WORDING_FORBIDDEN_PATTERNS) {
    const m = new RegExp(p, 'iu').exec(szoveg);
    if (m) return m[0];
  }
  return null;
}

/** Igaz, ha a mondat a belépési adatok megadására kér (és nem tiltja). SPEC §27.3.7. */
export function belepesKeres(mondat: string): boolean {
  if (!/(jelszav|belépési kód|Ügyfélkapu\+?-?\s*(?:belépés|jelszó)|DÁP-?\s*(?:belépés|kód|PIN))/iu.test(mondat)) return false;
  if (!/(add meg|küldd el|írd be|mondd meg|diktáld)/iu.test(mondat)) return false;
  return !VAN_NEM.test(mondat) && !/senkinek/iu.test(mondat);
}

/** Igaz, ha a mondat időpontfoglalást kínál (és nem a megszűnéséről vagy a korábbi foglalásokról szól). */
export function idopontAjanlat(mondat: string): boolean {
  if (!/(időpont(ot|ok)?\s+foglal|foglalj\s+időpontot|időpontfoglal|foglalt\s+időpont)/iu.test(mondat)) return false;
  return !/(már nem|megszűnt|korábban|helyett|óta nem|nem lehet)/iu.test(mondat);
}

/** Igaz, ha a mondat a lakcímkártya személyi azonosítós (hát)oldalát kéri. */
export function lakcimkartyaHatoldal(mondat: string): boolean {
  if (!/lakcímkárty[aá]/iu.test(mondat)) return false;
  if (!/(hátoldal|mindkét oldal|két oldal|másik oldal)/iu.test(mondat)) return false;
  return !/(^|[^\p{L}])(nem|ne|csak)([^\p{L}]|$)/iu.test(mondat);
}

export function aiEmlites(szoveg: string): boolean {
  return /(^|[^\p{L}])AI([^\p{L}]|$)/u.test(szoveg) || /mesterséges\s+intelligenci/iu.test(szoveg);
}

export function magazas(szoveg: string): boolean {
  return /(^|[^\p{L}])(Ön|Önnek|Önt|Önök|Öné)([^\p{L}]|$)/u.test(szoveg);
}

/** A „tartalom” kulcs érvényes SPEC §26 tartalomkulcs-e. */
export function tartalomKulcsJo(kulcs: string): boolean {
  if (/^visszahivas\.[a-z_]+$/.test(kulcs)) return true;
  const m = /^(notif|email)\.([a-z_]+)(?:\.([a-z_]+))?\.(title|body|subject)$/.exec(kulcs);
  if (!m) return false;
  const [, csoport, fajta, , mezo] = m;
  if (!(NOTIFICATION_KINDS as readonly string[]).includes(fajta!)) return false;
  if (csoport === 'notif' && mezo === 'subject') return false;
  if (csoport === 'email' && mezo === 'title') return false;
  return true;
}

/** Push-értesítésben tilos: összeg, telefonszám, adószám (SPEC §26.11). */
export function pushTiltott(szoveg: string): boolean {
  return /\{(amount|phone|phoneMasked|adoszam|adoazonositoJel|taxNumber)\}|\d{6,}|Ft\b/u.test(szoveg);
}

export interface Forras {
  fajl: string;
  szoveg: string;
}

/** Minden ügyfélnek szóló jogi szöveg (az index fájljai, a sablonok, az app-szövegek minden értéke). */
export async function osszesSzoveg(dir: string = CSOMAG_GYOKER): Promise<{ forrasok: Forras[]; app: AppSzovegek }> {
  const index = await betoltIndex(dir);
  const fajlok = new Set<string>();
  for (const e of index) {
    if (e.data) continue; // az app_szovegek.md generált; a JSON-t külön nézzük
    fajlok.add(e.file);
    if (e.pdfTemplate) fajlok.add(e.pdfTemplate);
  }
  // az önálló sablonok is (pl. az „Intézzük helyetted” utasítás, SPEC §27.10)
  for (const s of await betoltSablonok(dir)) fajlok.add(s.file);
  const forrasok: Forras[] = [];
  for (const f of [...fajlok].sort()) forrasok.push({ fajl: f, szoveg: await readFile(join(dir, f), 'utf8') });
  const app = JSON.parse(await readFile(join(dir, 'app_szovegek.json'), 'utf8')) as AppSzovegek;
  for (const [k, v] of Object.entries(app.szovegek)) forrasok.push({ fajl: `app_szovegek.json szovegek.${k}`, szoveg: Array.isArray(v) ? v.join('\n') : v });
  app.gyik.forEach((g, i) => forrasok.push({ fajl: `app_szovegek.json gyik[${i}]`, szoveg: `${g.kerdes}\n${g.valasz}` }));
  for (const [k, v] of Object.entries(app.tartalom ?? {})) forrasok.push({ fajl: `app_szovegek.json tartalom.${k}`, szoveg: v });
  return { forrasok, app };
}

/** A tartalmi szabályok megsértései (üres tömb = rendben). */
export async function tartalmiHibak(dir: string = CSOMAG_GYOKER): Promise<string[]> {
  const hibak: string[] = [];
  const { forrasok, app } = await osszesSzoveg(dir);

  for (const { fajl, szoveg } of forrasok) {
    if (fajl.startsWith('adatfeldolgozoi') ? false : magazas(szoveg)) hibak.push(`${fajl}: magázó „Ön” – tegezünk`);
    if (aiEmlites(szoveg)) hibak.push(`${fajl}: „AI” / mesterséges intelligencia nem szerepelhet`);
    if (anyadSzo(szoveg)) hibak.push(`${fajl}: „anyád” / „édesanyád” – az appban „anyukád”, a jogi szövegben „anyja születési neve” (SPEC §27)`);
    const szamla = szamlaTiltott(szoveg);
    if (szamla) hibak.push(`${fajl}: a kiállított számlákról tiltott megfogalmazás (SPEC §27.5): „${szamla}”`);
    for (const m of mondatok(szoveg)) {
      if (bejelentesAllitas(m)) hibak.push(`${fajl}: feltétel nélkül azt állítja, hogy mi jelentjük be a vállalkozást (SPEC §27.3: csak kérésre, meghatalmazottként, az utasítás szerint): „${m.slice(0, 120)}”`);
      if (csapatBekuld(m)) hibak.push(`${fajl}: a csapat nem küld be semmit a NAV-nak (SPEC §27.3.4): „${m.slice(0, 120)}”`);
      const tilt = tiltottKifejezes(m);
      if (tilt) hibak.push(`${fajl}: tiltott kifejezés (SPEC §27.10): „${tilt}” – „${m.slice(0, 120)}”`);
      if (belepesKeres(m)) hibak.push(`${fajl}: a belépési adatokat kéri (SPEC §27.3.7): „${m.slice(0, 120)}”`);
      if (idopontAjanlat(m)) hibak.push(`${fajl}: időpontfoglalást kínál (megszűnt, SPEC §26.2): „${m.slice(0, 120)}”`);
      if (lakcimkartyaHatoldal(m)) hibak.push(`${fajl}: a lakcímkártya hátoldalát kéri (Pmt. 7. § (8)): „${m.slice(0, 120)}”`);
    }
  }

  // SPEC §27.3.7: a „soha nem kérjük el” mondat ezekben benne van
  for (const f of ['aszf.md', 'adatkezeles.md', 'megbizasi_szerzodes.md', 'nav_meghatalmazas.md']) {
    const sz = forrasok.find((x) => x.fajl === f)?.szoveg ?? '';
    if (!/soha nem kérjük el/iu.test(sz)) hibak.push(`${f}: hiányzik a „soha nem kérjük el” (a belépést) mondat (SPEC §27.3.7)`);
  }

  // GYIK
  if (app.gyik.length !== GYIK_DARAB) hibak.push(`app_szovegek.json: ${GYIK_DARAB} GYIK-kérdés kell (most: ${app.gyik.length})`);
  const kerdesek = app.gyik.map((g) => g.kerdes);
  if (new Set(kerdesek).size !== kerdesek.length) hibak.push('app_szovegek.json: ismétlődő GYIK-kérdés');
  for (const k of UJ_GYIK_KERDESEK) if (!kerdesek.includes(k)) hibak.push(`app_szovegek.json: hiányzik a GYIK-kérdés (SPEC §26.2.7, §27.10): „${k}”`);
  for (const g of app.gyik) {
    if (g.elozo_valasz !== undefined && g.elozo_valasz === g.valasz && g.elozo_kerdes === undefined) hibak.push(`app_szovegek.json GYIK „${g.kerdes}”: az elozo_valasz ugyanaz, mint a valasz – töröld`);
    if (g.elozo_kerdes !== undefined && g.elozo_valasz === undefined) hibak.push(`app_szovegek.json GYIK „${g.kerdes}”: az elozo_kerdes mellé elozo_valasz is kell (SPEC §27.7.3)`);
  }
  const helyettem = app.gyik.find((g) => g.kerdes === 'Bejelentitek helyettem a vállalkozásomat?')?.valasz ?? '';
  if (!/soha nem kérjük el/iu.test(helyettem)) hibak.push('app_szovegek.json GYIK „Bejelentitek helyettem…”: hiányzik a „soha nem kérjük el” (SPEC §27.3.7)');

  // tartalom blokk
  const tartalom = app.tartalom ?? {};
  for (const [k, v] of Object.entries(tartalom)) {
    if (!tartalomKulcsJo(k)) hibak.push(`app_szovegek.json tartalom: ismeretlen tartalomkulcs: ${k}`);
    if (typeof v !== 'string' || v.trim() === '') hibak.push(`app_szovegek.json tartalom.${k}: üres`);
    if (/\{\{/.test(v)) hibak.push(`app_szovegek.json tartalom.${k}: itt {egy} kapcsos zárójel a helyőrző, nem {{kettő}}`);
    const fajta = /^notif\.([a-z_]+)\./.exec(k)?.[1];
    if (fajta && (PUSH_FAJTAK as readonly string[]).includes(fajta) && pushTiltott(v)) hibak.push(`app_szovegek.json tartalom.${k}: push-szövegben nem lehet összeg, telefonszám vagy adószám`);
  }
  if (tartalom['visszahivas.adatkezeles'] !== VISSZAHIVAS_ADATKEZELES) hibak.push('app_szovegek.json tartalom.visszahivas.adatkezeles: nem egyezik a SPEC §26.2.2 mondatával');

  // ÁSZF 13. kiemelt feltételek ↔ az app „szerzodes.kiemelt” listája (ugyanannyi pont)
  const aszf = forrasok.find((f) => f.fajl === 'aszf.md')?.szoveg ?? '';
  const kiemeltResz = aszf.split(/^## \d+\. Kiemelt feltételek\s*$/m)[1] ?? '';
  const aszfPontok = kiemeltResz.split('\n').filter((s) => s.startsWith('- ')).length;
  const appKiemelt = app.szovegek['szerzodes.kiemelt'];
  const appPontok = Array.isArray(appKiemelt) ? appKiemelt.length : 0;
  if (aszfPontok === 0 || aszfPontok !== appPontok) hibak.push(`a kiemelt feltételek száma eltér: ÁSZF ${aszfPontok}, app (szerzodes.kiemelt) ${appPontok}`);

  // NAV-meghatalmazás: a bejelölendő ügycsoportok ↔ meghatalmazas.ugykorok (az app ebből mutatja)
  const megh = forrasok.find((f) => f.fajl === 'nav_meghatalmazas.md')?.szoveg ?? '';
  const jelolt = [...megh.matchAll(/^- \[x\] \*\*(.+?)\*\*/gm)].map((m) => m[1]);
  const ugykorok = app.szovegek['meghatalmazas.ugykorok'];
  if (JSON.stringify(jelolt) !== JSON.stringify(ugykorok)) hibak.push(`nav_meghatalmazas.md bejelölt ügycsoportjai (${jelolt.join(' | ')}) ≠ meghatalmazas.ugykorok`);

  return hibak;
}

/** A jogi helyettunk.* szöveg → a shared ASSIST_TEXTS kulcsa (az app ezt mutatja). */
export const HELYETTUNK_SHARED: Record<string, keyof typeof ASSIST_TEXTS> = {
  'helyettunk.soha_belepes': 'neverCredentials',
  'helyettunk.engedely_nyilatkozat': 'consentDeclaration',
  'helyettunk.engedely_utasitas': 'consentInstruction',
  'helyettunk.engedely_nyilvanos': 'consentPublic',
  'helyettunk.ingyenes': 'free',
};

/**
 * A jogásznak szóló helyettunk.* szövegek eltérése a shared ASSIST_TEXTS-től (az app és a szerver a shared szöveget mutatja).
 * {{konyvelo.keresztnev}} = {firstName}, {{konyvelo.nev}} = {accountantName}. Csak figyelmeztetés.
 */
export function sharedElteresek(app: { szovegek: Record<string, string | string[]> }): string[] {
  const ki: string[] = [];
  for (const [jogiKulcs, sharedKulcs] of Object.entries(HELYETTUNK_SHARED)) {
    const j = app.szovegek[jogiKulcs];
    if (typeof j !== 'string') {
      ki.push(`${jogiKulcs}: hiányzik`);
      continue;
    }
    const normal = j.replace(/\{\{\s*konyvelo\.keresztnev\s*\}\}/g, '{firstName}').replace(/\{\{\s*konyvelo\.nev\s*\}\}/g, '{accountantName}');
    if (normal !== ASSIST_TEXTS[sharedKulcs]) ki.push(`${jogiKulcs} ≠ ASSIST_TEXTS.${sharedKulcs}`);
  }
  return ki;
}

/**
 * A backend tartalom-alapértékei és a jogi „tartalom” blokk eltérései. Források: a backend JSON-ja
 * (kod/backend/src/content/defaults.hu.json) és – ha vannak – a generált alapértékek TS-fájljai
 * (kod/backend/src/content/tulaj1118.ts, tulaj1119.ts; csak az egyszerű `out['kulcs'] = '…';` sorok).
 * Csak figyelmeztetés: a backend a saját mappájában, párhuzamosan dolgozik. Ha egyik fájl sincs meg, üres a lista.
 */
export async function backendElteresek(
  app: { tartalom?: Record<string, string> },
  backendJson: string,
  backendTs?: string | string[],
): Promise<{ elter: string[]; hianyzik: string[] }> {
  const be: Record<string, string> = {};
  let vanForras = false;
  try {
    Object.assign(be, JSON.parse(await readFile(backendJson, 'utf8')) as Record<string, string>);
    vanForras = true;
  } catch {
    /* nincs backend JSON */
  }
  for (const tsFajl of backendTs === undefined ? [] : Array.isArray(backendTs) ? backendTs : [backendTs]) {
    try {
      const ts = await readFile(tsFajl, 'utf8');
      for (const m of ts.matchAll(/out\['([a-z0-9_.]+)'\]\s*=\s*'((?:[^'\\]|\\.)*)';/g)) be[m[1]!] = m[2]!.replace(/\\(.)/g, '$1');
      vanForras = true;
    } catch {
      /* nincs TS-fájl */
    }
  }
  if (!vanForras) return { elter: [], hianyzik: [] };
  const elter: string[] = [];
  const hianyzik: string[] = [];
  for (const [k, v] of Object.entries(app.tartalom ?? {})) {
    if (!(k in be)) hianyzik.push(k);
    else if (be[k] !== v) elter.push(k);
  }
  return { elter, hianyzik };
}
