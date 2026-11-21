// Adózz.hu v2 – KOZEPRE: a Fluent-ikonok viewBox-eltolása, hogy a rajz a 32×32-es mező KÖZEPÉN üljön.
//
// Miért: néhány Fluent Emoji Flat rajz nincs a mező közepén (a tulaj 11-21-én vette észre: a „Nyilvántartásba vett
// könyvelő” igazolvány-ikonja lejjebb ült a csempében). A javítás a viewBoxot tolja el a rajz befoglaló dobozának
// közepére; a méret (32×32) marad, így a rajz nem torzul és nem lesz kisebb.
//
// Mérés: Chrome getBBox() mind a 45 ikonra – `node kod/shared/v2/scripts/meres-kozep.cjs` (a régi
// scratchpad/ikon_bbox.cjs és a dizajn/landing_v2_proba4/_eszkoz/epit.cjs mintájára). Eredmény: ikon/kozep-meres.json.
// Szabály: ahol a rajz közepe legalább 0,75 egységgel (34 px-es ikonnál ~0,8 px) eltér a mező közepétől, az bekerül ide,
// a mért eltéréssel (két tizedesre). A többi ikon eltérése ≤ 0,5 egység – azokhoz nem nyúlunk.
// Ellenőrzés: teszt/v2.test.mjs (minden ikon javított eltérése < 1 egység; a táblázat ikonjaié < 0,05).
//
// Az első öt sor azonos a landing (epit.cjs) táblázatával; a 11-21-i újramérés négy ikont talált még
// (kartya, figyelem, dosszie, fiok), amelyeket a landing nem használt.
// Ha a landing is erre a táblázatra áll át: ikon/kozepre.json (a gen-ikonok.mjs írja, CommonJS-ből is olvasható).

export const KOZEPRE: Readonly<Record<string, string>> = {
  igazolvany: '0 5 32 32', // mért: dy +5,00
  kamera: '0 4.5 32 32', // mért: dy +4,50
  emberek: '0 2.96 32 32', // mért: dy +2,965
  cimke: '0.03 2.11 32 32', // mért: dx +0,029, dy +2,108
  'irat-toll': '2.1 0 32 32', // mért: dx +2,103
  kartya: '0 5 32 32', // mért: dy +5,00 (11-21 újramérés)
  figyelem: '0 1.3 32 32', // mért: dy +1,304 (11-21 újramérés)
  dosszie: '0 1 32 32', // mért: dy +1,00 (11-21 újramérés)
  fiok: '-1 0 32 32', // mért: dx −1,00 (11-21 újramérés)
};

/** Ettől az eltéréstől (egységben, a 32×32-es mezőn) kerül egy ikon a táblázatba. */
export const KOZEPRE_KUSZOB = 0.75;
