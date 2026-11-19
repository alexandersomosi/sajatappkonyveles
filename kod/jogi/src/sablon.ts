// {{helyőrzők}} kitöltése a jogi szövegekben (SPEC §21).
// A kitöltés egyetlen menetben történik (a beillesztett érték nem értelmeződik újra sablonként),
// és a beillesztett értékből a Markdown-jelölés (** és sortörés) kikerül, hogy az ügyfél adata
// ne változtathassa meg a dokumentum szerkezetét.

import { HELYORZOK, HELYORZO_MINTA, ismertHelyorzo, type HelyorzoKulcs } from './helyorzok.js';
import { datumHu, forint } from './formatum.js';
import brandJson from './_shared/brand.json' with { type: 'json' };

export interface Marka {
  name: string;
  priceHufMonthlyGross: number;
  provider: {
    legalName: string;
    seat: string;
    taxNumber: string;
    registryNumber: string;
    supportEmail: string;
    representative?: string;
  };
}

/** A kod/shared/brand.json másolata (sync-shared). A termék neve csak ott változtatható. */
export const ALAP_MARKA: Marka = brandJson as Marka;

export interface DokAdat {
  verzio: string;
  /** "YYYY-MM-DD" */
  hatalyos: string;
  cim: string;
}

/**
 * Hiányzó ügyféladat kezelése:
 *  - 'cimke': "[HIÁNYZÓ: az ügyfél neve]" – előnézethez, a lap olvasásához az appban
 *  - 'ures' : kipontozott vonal – kézzel kitölthető nyomtatványhoz
 *  - 'hiba' : kivételt dob – éles PDF-hez, ahol minden adatnak meg kell lennie
 */
export type HianyMod = 'cimke' | 'ures' | 'hiba';

export type KitoltesAdat = Partial<Record<HelyorzoKulcs, string | number | null | undefined>>;

export interface KitoltesOpciok {
  adat?: KitoltesAdat;
  marka?: Marka;
  dok?: DokAdat;
  hiany?: HianyMod;
  /** A "mai nap" (alapból most, Europe/Budapest). */
  ma?: Date | string;
}

export interface KitoltesEredmeny {
  szoveg: string;
  /** Kulcsok, amelyekhez nem volt adat (és cimke/ures módban jelölve maradtak). */
  hianyzo: HelyorzoKulcs[];
  /** A jegyzékben nem szereplő kulcsok – ezek változatlanul maradnak. */
  ismeretlen: string[];
}

export class HianyzoAdatHiba extends Error {
  constructor(readonly kulcsok: string[]) {
    super(`Hiányzó adat a jogi sablonban: ${kulcsok.join(', ')}`);
    this.name = 'HianyzoAdatHiba';
  }
}

const URES_VONAL = '………………………………………………';
/** Egy beillesztett érték legnagyobb hossza (a tevékenységlista vagy az utasítás szövege is beférjen). */
const MAX_ERTEK_HOSSZ = 1000;

/**
 * Magyar határozott névelő a következő szó elé: „az” magánhangzóval kezdődő kiejtés előtt, különben „a”.
 * A számokat és a római számokat kimondva nézzük: „az I.” (első), „a II.”, „az 5” (öt), „az 1956” (ezer…), „a 2026”.
 * Ugyanaz a szabály, mint a backend `huArticle()`-je (kod/backend/src/lib/nevelo.ts).
 */
export function huNevelo(szo: string): 'a' | 'az' {
  const w = szo.trim().replace(/^[[(„"'«]+/, '');
  const romai = /^([IVXLCDM]+)\./.exec(w);
  if (romai) return /^(I|V|L|D|M)$/.test(romai[1]!) ? 'az' : 'a';
  const szam = /^(\d+)/.exec(w);
  if (szam) {
    const n = szam[1]!;
    if (n.startsWith('5')) return 'az';
    if (n.startsWith('1') && (n.length === 1 || n.length === 4 || n.length === 7)) return 'az';
    return 'a';
  }
  return /^[aáeéiíoóöőuúüű]/i.test(w) ? 'az' : 'a';
}

/** „a(z) X” → „a X” / „az X” a kitöltött szövegben (a „[HIÁNYZÓ: …]” és a „[CÉGADAT: …]” elé „a”). */
export function nevelokFeloldasa(szoveg: string): string {
  return szoveg.replace(
    /(^|[^\p{L}])([Aa])\(z\)([ \t ]+)([[(„"'«]*)([\p{L}\p{N}][\p{L}\p{N}.]*)/gu,
    (_m, elo: string, a: string, koz: string, nyito: string, szo: string) => {
      const n = huNevelo(szo);
      return `${elo}${a === 'A' ? n.charAt(0).toUpperCase() + n.slice(1) : n}${koz}${nyito}${szo}`;
    },
  );
}

/** Az ügyfél adatából kiveszi, ami a Markdown szerkezetét megváltoztatná. */
export function biztonsagosErtek(ertek: string): string {
  if (ertek === ' ') return ' '; // jelölőnégyzet üres állapota
  const s = ertek
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/\*\*/g, '')
    .replace(/\{\{|\}\}/g, '')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
  return s.length > MAX_ERTEK_HOSSZ ? `${s.slice(0, MAX_ERTEK_HOSSZ - 1)}…` : s;
}

function markaErtek(kulcs: HelyorzoKulcs, marka: Marka): string | undefined {
  const p = marka.provider;
  switch (kulcs) {
    case 'brand.name': return marka.name;
    case 'ceg.nev': return p.legalName;
    case 'ceg.szekhely': return p.seat;
    case 'ceg.adoszam': return p.taxNumber;
    case 'ceg.cegjegyzekszam': return p.registryNumber;
    case 'ceg.email': return p.supportEmail;
    case 'ceg.kepviselo': return p.representative ?? '[CÉGADAT: ügyvezető neve]';
    case 'dij.havi_brutto': return forint(marka.priceHufMonthlyGross);
    default: return undefined;
  }
}

function dokErtek(kulcs: HelyorzoKulcs, dok: DokAdat | undefined): string | undefined {
  if (!dok) return undefined;
  switch (kulcs) {
    case 'dok.verzio': return dok.verzio;
    case 'dok.hatalyos': return datumHu(dok.hatalyos);
    case 'dok.cim': return dok.cim;
    default: return undefined;
  }
}

/** Egy kulcs értéke, vagy undefined, ha nincs. */
export function ertek(kulcs: HelyorzoKulcs, opc: KitoltesOpciok = {}): string | undefined {
  const marka = opc.marka ?? ALAP_MARKA;
  const nyers = opc.adat?.[kulcs];
  if (nyers !== undefined && nyers !== null) {
    const s = typeof nyers === 'number' ? String(nyers) : nyers;
    if (s.length > 0) {
      const b = biztonsagosErtek(s);
      if (b.length > 0) return b;
    }
  }
  const m = markaErtek(kulcs, marka);
  if (m !== undefined) return m;
  const d = dokErtek(kulcs, opc.dok);
  if (d !== undefined) return d;
  if (kulcs === 'datum.ma') return datumHu(opc.ma ?? new Date());
  if (kulcs === 'elofizetes.max_osszeg') return forint(marka.priceHufMonthlyGross);
  const leiras = HELYORZOK[kulcs] as { tartalek?: string };
  if (leiras.tartalek !== undefined) return leiras.tartalek;
  return undefined;
}

/** Kitölti a sablont. Lásd HianyMod. */
export function kitolt(sablon: string, opc: KitoltesOpciok = {}): KitoltesEredmeny {
  const hiany = opc.hiany ?? 'cimke';
  const hianyzo = new Set<HelyorzoKulcs>();
  const ismeretlen = new Set<string>();

  const szoveg = sablon.replace(HELYORZO_MINTA, (teljes, kulcs: string, hol: number) => {
    if (!ismertHelyorzo(kulcs)) {
      ismeretlen.add(kulcs);
      return teljes;
    }
    const e = ertek(kulcs, opc);
    // "2026. január 8." vagy "Somosi Kft." mondat végén: ne legyen dupla pont
    if (e !== undefined) return e.endsWith('.') && sablon[hol + teljes.length] === '.' ? e.slice(0, -1) : e;
    hianyzo.add(kulcs);
    if (hiany === 'ures') return URES_VONAL;
    return `[HIÁNYZÓ: ${HELYORZOK[kulcs].cimke}]`;
  });

  if (hiany === 'hiba' && (hianyzo.size > 0 || ismeretlen.size > 0)) {
    throw new HianyzoAdatHiba([...hianyzo, ...ismeretlen]);
  }
  // „a(z) {{brand.name}}” → „a Kézjegy” (k3 kör 2, tulaj 6: a minták „a(z) Kézjegy”-et írtak)
  return { szoveg: nevelokFeloldasa(szoveg), hianyzo: [...hianyzo], ismeretlen: [...ismeretlen] };
}
