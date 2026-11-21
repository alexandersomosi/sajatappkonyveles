// k8 mozgások (K8_VEGREHAJTAS 4. fejezet) – az időtartamok és a döntési logika, React Native nélkül (a tesztek Node-ban
// futtatják). Szabály: 0,2–0,4 s, csak transform és opacity, nincs folyamatos vagy ismétlődő mozgás; csökkentett mozgásnál
// (rendszerbeállítás, böngésző prefers-reduced-motion, képernyőkép-mód) semmi nem mozog.
import { mozgas } from '../_shared/v2/tokenek';

/** Mozgások ezredmásodpercben. A kivételek (indokolva, A_jegyzet): `lenyomas` 100 ms (azonnali visszajelzés), `konfetti` ≤ 1,2 s
 *  (a tulaj kérte, egyszeri), a `beuszasKesleltetes` 50 ms (nem önálló mozgás, csak a kártyák egymásutánja). */
export const MOZGAS_IDO = {
  beuszas: mozgas.alap, // 1 – főoldal kártyái: opacity 0→1, translateY 12→0
  beuszasKesleltetes: 50,
  beuszasMax: 6, // legfeljebb ennyi kártya kap késleltetést
  porges: mozgas.hosszu, // 2 – a fő összeg felpörgése
  csik: mozgas.hosszu, // 3 – haladás- és keretcsík feltöltődése (scaleX)
  lenyomas: mozgas.lenyomas, // 4 – gomb benyomódása (le)
  felengedes: mozgas.rovid, // 4 – vissza
  pipa: 350, // 5 – felpattanó zöld pipa
  konfetti: mozgas.konfettiMax, // 6 – egyszeri konfetti
  villanas: mozgas.rovid, // 7 – fotózás villanás
  repules: mozgas.hosszu, // 7 – a kép a Dosszié fül felé repül
  attunes: mozgas.rovid, // 8 – a helykitöltő után a tartalom áttűnése
  fulUgras: 250, // 9 – a kiválasztott fül ikonja megugrik
  pontPattan: mozgas.alap, // 9 – az olvasatlan pötty felpattan
  emeles: mozgas.rovid, // 10 – gép: kártya egér fölött
  kiemeles: mozgas.rovid, // 11 – gép: gomb egér fölött
  behuzas: mozgas.rovid, // 12 – gép: fájl behúzása
  listaRepules: mozgas.alap, // 13 – gép: a feltöltött fájl a listába érkezik
} as const;

export type MozgasNev = keyof typeof MOZGAS_IDO;

/** Az indokolt kivételek a 0,2–0,4 s szabály alól (a teszt ezeken kívül mindent ellenőriz). */
export const MOZGAS_KIVETEL: readonly MozgasNev[] = ['lenyomas', 'konfetti', 'beuszasKesleltetes', 'beuszasMax'];

export const BENYOMODAS = mozgas.benyomodas; // 0,97
export const GORBE = mozgas.gorbe; // cubic-bezier(0.22, 1, 0.36, 1)

/** Kell-e mozgás? Képernyőkép-módban és csökkentett mozgásnál soha. */
export function mozgasKiLogika(a: { kepernyokep: boolean; rendszerCsokkentett: boolean | null | undefined }): boolean {
  return a.kepernyokep || a.rendszerCsokkentett === true;
}

/** A kártya beúszásának késleltetése a sorszám szerint (a 6. után nincs több várakozás). */
export function beuszasKesleltetes(index: number): number {
  return Math.max(0, Math.min(index, MOZGAS_IDO.beuszasMax - 1)) * MOZGAS_IDO.beuszasKesleltetes;
}

/** A felpörgő összeg köztes értéke (out-cubic görbe, egész forintra kerekítve). */
export function porgoErtek(veg: number, t: number): number {
  const x = Math.max(0, Math.min(1, t));
  const e = 1 - Math.pow(1 - x, 3);
  return Math.round(veg * e);
}
