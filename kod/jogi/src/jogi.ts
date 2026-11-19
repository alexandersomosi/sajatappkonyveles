// A jogi dokumentumok betöltése (index.json), kitöltése és PDF-be szedése.
// A backend ezt hívja a `GET /legal/:docType` és a `GET /client/legal-pdf/:docType` végponthoz (SPEC §12),
// és a megbízási szerződés elfogadás utáni másolatához (SPEC §10.2 4.).

import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { join, resolve, sep } from 'node:path';
import { LEGAL_DOC_TYPES, type LegalDocType } from './_shared/enums.js';
import { kitolt, ALAP_MARKA, type HianyMod, type KitoltesAdat, type Marka } from './sablon.js';
import { parse } from './markdown.js';
import { markdownPdf, type Betuk, type Elfogadas } from './pdf.js';

export interface IndexElem {
  docType: LegalDocType;
  version: string;
  title: string;
  file: string;
  requiresReconsent: boolean;
  /** "YYYY-MM-DD" */
  effectiveFrom: string;
  /** Kinek szól: ügyfél (appban látszik), belső (Kft. ↔ könyvelő, appszövegek forrása). */
  audience: 'ugyfel' | 'belso';
  showInApp: boolean;
  /** Letölthető-e PDF-ben. */
  pdf: boolean;
  /** A PDF az ügyfél adataival kitöltve készül (különben "cimke" módban, az ügyfél adatai nélkül). */
  pdfPrefilled?: boolean;
  /** Ha a PDF nem magát a dokumentumot, hanem egy nyomtatványt tartalmaz (pl. meghatalmazás okirat). */
  pdfTemplate?: string;
  pdfTitle?: string;
  /** Gépi adatforrás (app_szovegek.json). */
  data?: string;
  /** Amíg igaz, minden oldalon "TERVEZET" jelzés. */
  draft: boolean;
}

/** A csomag gyökere (itt van az index.json, a *.md, a sablonok/, a fonts/, a kepek/). */
export const CSOMAG_GYOKER = fileURLToPath(new URL('..', import.meta.url));

function ellenorzottUt(gyoker: string, relativ: string): string {
  const g = resolve(gyoker);
  const ut = resolve(g, relativ);
  if (ut !== g && !ut.startsWith(g + sep)) throw new Error(`Érvénytelen útvonal az index.json-ban: ${relativ}`);
  return ut;
}

/** A dokumentumverzió formája: "2026-11-18" vagy ugyanazon a napon a második kiadás "2026-11-18.2" (legfeljebb .9). */
export const VERZIO_MINTA = /^\d{4}-\d{2}-\d{2}(\.[2-9])?$/;

export async function betoltIndex(dir: string = CSOMAG_GYOKER): Promise<IndexElem[]> {
  const nyers = JSON.parse(await readFile(join(dir, 'index.json'), 'utf8')) as IndexElem[];
  if (!Array.isArray(nyers)) throw new Error('index.json: tömböt várunk');
  for (const e of nyers) {
    if (!(LEGAL_DOC_TYPES as readonly string[]).includes(e.docType)) throw new Error(`index.json: ismeretlen docType: ${e.docType}`);
    // verzió: "YYYY-MM-DD", ugyanazon a napon a következő kiadás "YYYY-MM-DD.2" (szövegként rendezve is nő)
    if (!VERZIO_MINTA.test(e.version) || !/^\d{4}-\d{2}-\d{2}$/.test(e.effectiveFrom)) {
      throw new Error(`index.json: hibás verzió vagy dátum: ${e.docType}`);
    }
  }
  return nyers;
}

export async function indexElem(docType: LegalDocType, dir: string = CSOMAG_GYOKER): Promise<IndexElem> {
  const e = (await betoltIndex(dir)).find((x) => x.docType === docType);
  if (!e) throw new Error(`Nincs ilyen jogi dokumentum: ${docType}`);
  return e;
}

export function sha256(szoveg: string | Uint8Array): string {
  return createHash('sha256').update(szoveg).digest('hex');
}

export interface ForrasDokumentum {
  elem: IndexElem;
  /** A nyers Markdown, helyőrzőkkel. */
  markdown: string;
  /** A nyers fájl SHA-256-ja (legal_documents.sha256). */
  sha256: string;
}

/** A dokumentum forrása (a `legal_documents` feltöltéséhez). */
export async function forras(docType: LegalDocType, dir: string = CSOMAG_GYOKER): Promise<ForrasDokumentum> {
  const elem = await indexElem(docType, dir);
  const markdown = await readFile(ellenorzottUt(dir, elem.file), 'utf8');
  return { elem, markdown, sha256: sha256(markdown) };
}

export interface KitoltesKeres {
  adat?: KitoltesAdat;
  /** Alapból: 'cimke'. Éles, kitöltött PDF-hez javasolt: 'hiba' vagy 'ures'. */
  hiany?: HianyMod;
  marka?: Marka;
  ma?: Date | string;
  dir?: string;
  /** Igaz: a PDF-sablont (pl. meghatalmazás okirat) töltjük ki, nem az olvasható dokumentumot. */
  pdfSablon?: boolean;
  /**
   * A belső jegyzetek ([JOGI: …], [TULAJ: …], [KÖNYVELŐ: …], [ELLENŐRIZNI: …]) maradjanak-e. Alapból az ügyfélnek szóló
   * dokumentumból (audience 'ugyfel') kikerülnek, a belsőben (Kft. ↔ könyvelő) maradnak (k3 kör 2, tulaj 12; SPEC §27.10).
   */
  belsoJegyzetek?: boolean;
}

/** A belső jegyzetek címkéi. A [CÉGADAT: …], a [SIMPLEPAY: …] és a [HIÁNYZÓ: …] hiányzó értéket jelöl: az marad. */
export const BELSO_JEGYZET_CIMKEK = ['JOGI', 'TULAJ', 'KÖNYVELŐ', 'ELLENŐRIZNI', 'OWNER'] as const;
const CIMKE = `(?:${BELSO_JEGYZET_CIMKEK.join('|')})`;
/**
 * Egy belső jegyzet: `[JOGI]`, `[TULAJ: …]`, `[JOGI/TULAJ: …]`, `**[KÖNYVELŐ]**`, az előtte álló szóközzel együtt.
 * A backend (kod/backend/src/legal.ts) ugyanezt a mintát használja (SPEC §27.10).
 */
export const BELSO_JEGYZET_MINTA = new RegExp(`[ \\t]*(?:\\*\\*)?\\[${CIMKE}(?:\\/${CIMKE})*(?::[^\\]\\n]*)?\\](?:\\*\\*)?`, 'gu');

/**
 * Kiveszi a belső jegyzeteket. Ha egy sor ettől kiürül (vagy csak egy „- ” marad), a sor is kikerül; a két üres sornál
 * hosszabb hézag egyre szűkül. A Markdown szerkezete (címek, listák) nem változik.
 */
export function belsoJegyzetekNelkul(md: string): string {
  const sorok = md.replace(/\r\n?/g, '\n').split('\n');
  const ki: string[] = [];
  for (const sor of sorok) {
    if (!BELSO_JEGYZET_MINTA.test(sor)) {
      BELSO_JEGYZET_MINTA.lastIndex = 0;
      ki.push(sor);
      continue;
    }
    BELSO_JEGYZET_MINTA.lastIndex = 0;
    const tiszta = sor.replace(BELSO_JEGYZET_MINTA, '').replace(/[ \t]+$/, '');
    if (/^\s*(?:[-*]|\d{1,3}\.)?\s*$/.test(tiszta)) continue; // kiürült sor vagy üres listaelem
    ki.push(tiszta);
  }
  return ki.join('\n').replace(/\n{3,}/g, '\n\n');
}

export interface KitoltottDokumentum {
  elem: IndexElem;
  cim: string;
  markdown: string;
  hianyzo: string[];
  /** A kitöltött szöveg SHA-256-ja – ezt fogadta el az ügyfél. */
  sha256: string;
}

/** A `GET /legal/:docType` válaszához: a dokumentum, a márka/cég adataival (és ha van, az ügyfél adataival) kitöltve. */
export async function kitoltottDokumentum(docType: LegalDocType, k: KitoltesKeres = {}): Promise<KitoltottDokumentum> {
  const dir = k.dir ?? CSOMAG_GYOKER;
  const elem = await indexElem(docType, dir);
  const fajl = k.pdfSablon && elem.pdfTemplate ? elem.pdfTemplate : elem.file;
  const cim = k.pdfSablon && elem.pdfTitle ? elem.pdfTitle : elem.title;
  const forrasSzoveg = await readFile(ellenorzottUt(dir, fajl), 'utf8');
  const jegyzetekkel = k.belsoJegyzetek ?? elem.audience !== 'ugyfel';
  const nyers = jegyzetekkel ? forrasSzoveg : belsoJegyzetekNelkul(forrasSzoveg);
  const { szoveg, hianyzo } = kitolt(nyers, {
    adat: k.adat,
    marka: k.marka,
    hiany: k.hiany ?? 'cimke',
    ma: k.ma,
    dok: { verzio: elem.version, hatalyos: elem.effectiveFrom, cim: elem.title },
  });
  return { elem, cim, markdown: szoveg, hianyzo, sha256: sha256(szoveg) };
}

// --- betűk és textúra (gyorsítótárazva) ---
const fajlCache = new Map<string, Promise<Uint8Array>>();
function olvas(ut: string): Promise<Uint8Array> {
  let p = fajlCache.get(ut);
  if (!p) {
    p = readFile(ut).then((b) => new Uint8Array(b));
    p.catch(() => fajlCache.delete(ut));
    fajlCache.set(ut, p);
  }
  return p;
}

export async function betoltBetuk(betuDir: string = join(CSOMAG_GYOKER, 'fonts')): Promise<Betuk> {
  const [normal, felkover] = await Promise.all([
    olvas(join(betuDir, 'Geist-Regular.ttf')),
    olvas(join(betuDir, 'Geist-SemiBold.ttf')),
  ]);
  return { normal, felkover };
}

export interface PdfKeres extends KitoltesKeres {
  /** A Geist-Regular.ttf és Geist-SemiBold.ttf helye (FONT_DIR). Alapból a csomag fonts/ mappája. */
  betuDir?: string;
  /** Elfogadási záradék (pl. a megbízási szerződés elfogadás utáni másolatához). */
  elfogadas?: Elfogadas;
  /** A PDF készítési ideje (tesztekhez). */
  most?: Date;
  /** false: sima tintakék sáv textúra nélkül (kisebb fájl). */
  textura?: boolean;
  lablecMegjegyzes?: string;
}

export interface JogiPdf {
  pdf: Uint8Array;
  /** ASCII fájlnév a Content-Disposition fejléchez. */
  fajlnev: string;
  cim: string;
  verzio: string;
  oldalak: number;
  hianyzo: string[];
  /** A kitöltött szöveg SHA-256-ja (az elfogadási záradékban is). */
  sha256: string;
  figyelmeztetesek: string[];
}

function asciiNev(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^A-Za-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 60);
}

/**
 * Egy jogi dokumentum PDF-ben.
 * - Ha az indexben van `pdfTemplate` (meghatalmazás okirat, Pmt.-adatlap), azt szedi.
 * - Az ügyféladatokkal kitöltött PDF-hez add meg az `adat`-ot és a `hiany` módot.
 */
export async function jogiPdf(docType: LegalDocType, k: PdfKeres = {}): Promise<JogiPdf> {
  const dir = k.dir ?? CSOMAG_GYOKER;
  // alapból a PDF-sablon (ha van); pdfSablon: false → az olvasható dokumentum (pl. az ONYA-útmutató)
  const doku = await kitoltottDokumentum(docType, { ...k, dir, pdfSablon: k.pdfSablon ?? true });
  if (!doku.elem.pdf) throw new Error(`Ehhez a dokumentumhoz nincs PDF: ${docType}`);
  const marka = k.marka ?? ALAP_MARKA;
  const betuk = await betoltBetuk(k.betuDir);
  const textura = k.textura === false ? undefined : await olvas(join(CSOMAG_GYOKER, 'kepek', 'fejlec_guilloche.png'));
  const blokkok = parse(doku.markdown);
  const eredmeny = await markdownPdf(blokkok, {
    cim: doku.cim,
    marka: marka.name,
    ceg: marka.provider.legalName,
    verzio: doku.elem.version,
    betuk,
    textura,
    elfogadas: k.elfogadas,
    ujjlenyomat: k.elfogadas ? doku.sha256 : undefined,
    most: k.most,
    lablecMegjegyzes: k.lablecMegjegyzes,
  });
  return {
    pdf: eredmeny.pdf,
    fajlnev: `${asciiNev(doku.cim)}_${doku.elem.version}.pdf`,
    cim: doku.cim,
    verzio: doku.elem.version,
    oldalak: eredmeny.oldalak,
    hianyzo: doku.hianyzo,
    sha256: doku.sha256,
    figyelmeztetesek: eredmeny.figyelmeztetesek,
  };
}

// --- Önálló sablonok (nem a legal_documents része; sablonok/sablonok.json) ---

export interface SablonElem {
  /** pl. 'ev_bejelentes_utasitas' */
  nev: string;
  file: string;
  /** "YYYY-MM-DD" vagy ugyanazon a napon "YYYY-MM-DD.2" (VERZIO_MINTA). */
  version: string;
  title: string;
  audience: 'ugyfel' | 'belso';
  draft: boolean;
  leiras?: string;
}

export async function betoltSablonok(dir: string = CSOMAG_GYOKER): Promise<SablonElem[]> {
  const nyers = JSON.parse(await readFile(join(dir, 'sablonok', 'sablonok.json'), 'utf8')) as SablonElem[];
  if (!Array.isArray(nyers)) throw new Error('sablonok/sablonok.json: tömböt várunk');
  for (const s of nyers) {
    if (!/^[a-z0-9_]+$/.test(s.nev) || !VERZIO_MINTA.test(s.version)) throw new Error(`sablonok.json: hibás név vagy verzió: ${s.nev}`);
  }
  return nyers;
}

/** SPEC §27.3.3: az ügyfél utasítása a vállalkozása bejelentésére („Intézzük helyetted”). */
export const EV_BEJELENTES_UTASITAS = 'ev_bejelentes_utasitas';

export interface SablonKeres extends Omit<PdfKeres, 'pdfSablon'> {
  /** Alapból 'hiba': éles irathoz minden adatnak meg kell lennie. */
  hiany?: HianyMod;
}

/** Egy önálló sablon kitöltve (a {{utasitas.verzio}} a sablonok.json-ból jön, ha a hívó nem adja meg). */
export async function kitoltottSablon(nev: string, k: SablonKeres = {}): Promise<KitoltottDokumentum & { sablon: SablonElem }> {
  const dir = k.dir ?? CSOMAG_GYOKER;
  const sablon = (await betoltSablonok(dir)).find((s) => s.nev === nev);
  if (!sablon) throw new Error(`Nincs ilyen sablon: ${nev}`);
  const forrasSzoveg = await readFile(ellenorzottUt(dir, sablon.file), 'utf8');
  const jegyzetekkel = k.belsoJegyzetek ?? sablon.audience !== 'ugyfel';
  const nyers = jegyzetekkel ? forrasSzoveg : belsoJegyzetekNelkul(forrasSzoveg);
  const adat: KitoltesAdat = { 'utasitas.verzio': sablon.version, ...(k.adat ?? {}) };
  const { szoveg, hianyzo } = kitolt(nyers, {
    adat,
    marka: k.marka,
    hiany: k.hiany ?? 'hiba',
    ma: k.ma,
    dok: { verzio: sablon.version, hatalyos: sablon.version.slice(0, 10), cim: sablon.title },
  });
  // az elem a meghívók kedvéért IndexElem-alakú (a PDF-szedő a verziót és a címet használja belőle)
  const elem: IndexElem = {
    docType: 'app_szovegek',
    version: sablon.version,
    title: sablon.title,
    file: sablon.file,
    requiresReconsent: false,
    effectiveFrom: sablon.version.slice(0, 10),
    audience: sablon.audience,
    showInApp: false,
    pdf: true,
    draft: sablon.draft,
  };
  return { elem, sablon, cim: sablon.title, markdown: szoveg, hianyzo, sha256: sha256(szoveg) };
}

/** Egy önálló sablon PDF-ben (pl. az utasítás: `sablonPdf('ev_bejelentes_utasitas', { adat })`). */
export async function sablonPdf(nev: string, k: SablonKeres = {}): Promise<JogiPdf> {
  const doku = await kitoltottSablon(nev, k);
  const marka = k.marka ?? ALAP_MARKA;
  const betuk = await betoltBetuk(k.betuDir);
  const textura = k.textura === false ? undefined : await olvas(join(CSOMAG_GYOKER, 'kepek', 'fejlec_guilloche.png'));
  const eredmeny = await markdownPdf(parse(doku.markdown), {
    cim: doku.cim,
    marka: marka.name,
    ceg: marka.provider.legalName,
    verzio: doku.sablon.version,
    betuk,
    textura,
    elfogadas: k.elfogadas,
    ujjlenyomat: k.elfogadas ? doku.sha256 : undefined,
    most: k.most,
    lablecMegjegyzes: k.lablecMegjegyzes,
  });
  return {
    pdf: eredmeny.pdf,
    fajlnev: `${asciiNev(doku.cim)}_${doku.sablon.version}.pdf`,
    cim: doku.cim,
    verzio: doku.sablon.version,
    oldalak: eredmeny.oldalak,
    hianyzo: doku.hianyzo,
    sha256: doku.sha256,
    figyelmeztetesek: eredmeny.figyelmeztetesek,
  };
}

export interface GyikElem {
  kerdes: string;
  valasz: string;
  /** SPEC §27.7.3: a 11-19-i változás előtti pontos kérdés (csak ha a kérdés is változott). */
  elozo_kerdes?: string;
  /** SPEC §27.7.3: a változás előtti pontos válasz – az élő sort csak akkor írjuk át, ha még ez áll benne. */
  elozo_valasz?: string;
}

export interface AppSzovegek {
  _meta: Record<string, string>;
  szovegek: Record<string, string | string[]>;
  gyik: GyikElem[];
  /**
   * SPEC §26 tartalomkulcsok (content_texts), amelyeket a jogász is átnéz: visszahívás, ügyfél-értesítések.
   * A helyőrző itt {egy} kapcsos zárójel (a backend tölti ki); ezeket az appSzovegek() nem tölti ki.
   */
  tartalom?: Record<string, string>;
}

/** Az appszövegek kitöltve (márka, cég, díj; a többi helyőrző marad, ha nincs adat). */
export async function appSzovegek(k: { adat?: KitoltesAdat; marka?: Marka; dir?: string } = {}): Promise<AppSzovegek> {
  const dir = k.dir ?? CSOMAG_GYOKER;
  const nyers = JSON.parse(await readFile(join(dir, 'app_szovegek.json'), 'utf8')) as AppSzovegek;
  const t = (s: string): string => {
    // ismeretlen futásidejű adatnál a helyőrző marad, hogy a hívó később kitölthesse
    let ki = s;
    ki = ki.replace(/\{\{\s*([a-z0-9_.]+)\s*\}\}/g, (teljes, kulcs: string) => {
      const r = kitolt(`{{${kulcs}}}`, { adat: k.adat, marka: k.marka });
      return r.hianyzo.length > 0 || r.ismeretlen.length > 0 ? teljes : r.szoveg;
    });
    return ki;
  };
  const szovegek: Record<string, string | string[]> = {};
  for (const [kulcs, v] of Object.entries(nyers.szovegek)) szovegek[kulcs] = Array.isArray(v) ? v.map(t) : t(v);
  return {
    _meta: nyers._meta,
    szovegek,
    gyik: nyers.gyik.map((g) => ({
      kerdes: t(g.kerdes),
      valasz: t(g.valasz),
      ...(g.elozo_kerdes !== undefined ? { elozo_kerdes: t(g.elozo_kerdes) } : {}),
      ...(g.elozo_valasz !== undefined ? { elozo_valasz: t(g.elozo_valasz) } : {}),
    })),
    tartalom: { ...(nyers.tartalom ?? {}) },
  };
}
