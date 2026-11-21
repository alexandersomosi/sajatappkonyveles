// Adózz.hu v2 – az ikonadatok típusai (React nélkül; RN-ben és webes Reactben is fordul).

/** Egy rajzelem: telt útvonal (`p`) vagy lekerekített téglalap (`r`). Csak telt szín van, körvonal nincs. */
export type IkonElem =
  | { readonly t: 'p'; readonly d: string; readonly f: string; readonly eo?: true }
  | { readonly t: 'r'; readonly x: number; readonly y: number; readonly w: number; readonly h: number; readonly rx: number; readonly f: string };

/** Színes ikon: viewBox (a KOZEPRE-javítás már benne van) + rajzelemek. */
export interface IkonAdat {
  readonly vb: string;
  readonly elemek: readonly IkonElem[];
}

/** Egyszínű vezérlő-ikon (24×24): telt útvonal, vagy körvonal (`vonal` = vonalvastagság, kerek vég és sarok). */
export interface VezerloAdat {
  readonly d: string;
  readonly vonal?: number;
}

/** Az emoji-ikon színváltozata: `szines` (alap), `szurke` (CSS grayscale(1) – mezőben),
 *  `vilagos` (grayscale(1) brightness(3) – a kék fejléc háttérrajza). */
export type IkonValtozat = 'szines' | 'szurke' | 'vilagos';
