// k8 gépes nézet (K8_VEGREHAJTAS 3. fejezet) – a töréspont, a menü és az aktív menüpont tiszta logikája (React Native
// nélkül, a tesztek Node-ban futtatják). A hookok: lib/elrendezes.ts.
import { elrendezes, torespont } from '../_shared/v2/tokenek';

export const ASZTALI_TORES = torespont.asztali; // 1024: efölött gépes elrendezés
export const SZELES_TORES = torespont.szelesAsztali; // 1360: efölött a szélesebb menü és margó
export const TARTALOM_MAX = torespont.tartalomMax; // 1120
export const TELEFON_MAX = torespont.mobilMax; // 480: telefonos elrendezés legfeljebb ilyen széles
export const MINTA_NELKULI_MAX = 760; // a minta nélküli képernyők egy kártyaoszlopa gépen

/**
 * Gépes elrendezés: csak weben, legalább 1024 pt széles ablakban, és ha nincs rögzített telefonos képernyőkép-szélesség
 * (`?szelesseg=390`). Natívan (telefon, tablet) mindig telefonos.
 */
export function asztaliE(a: { web: boolean; szelesseg: number; keretSzelesseg: number | null }): boolean {
  return a.web && a.keretSzelesseg === null && a.szelesseg >= ASZTALI_TORES;
}

export function szelesAsztaliE(a: { web: boolean; szelesseg: number; keretSzelesseg: number | null }): boolean {
  return asztaliE(a) && a.szelesseg >= SZELES_TORES;
}

/** A bal menüsáv szélessége (1360 alatt 232, fölötte 248). */
export function menuSzelesseg(szelesseg: number): number {
  return szelesseg >= SZELES_TORES ? elrendezes.asztali.menuSzeles : elrendezes.asztali.menuSzelesKisebb;
}

/** A tartalomoszlop margói (fent, oldalt, lent). */
export function tartalomMargo(szelesseg: number): { fent: number; oldal: number; lent: number } {
  const a = elrendezes.asztali;
  return szelesseg >= SZELES_TORES
    ? { fent: a.tartalomFent, oldal: a.tartalomOldal, lent: a.tartalomLent }
    : { fent: a.tartalomFentKisebb, oldal: a.tartalomOldalKisebb, lent: a.tartalomLentKisebb };
}

/** Ahol a bal menü NEM látszik (teljes képernyős utak): belépés, bevezető, jogi, e-mail-megerősítés, 404, vezetett lépés. */
const MENU_NELKUL = new Set(['(auth)', 'bevezeto', 'jogi', 'email-megerosites', '+not-found', '_sitemap']);

export function oldalsavLathatoE(a: { asztali: boolean; bent: boolean; elsoSzegmens: string | undefined; vezetett: boolean }): boolean {
  if (!a.asztali || !a.bent || a.vezetett) return false;
  return !MENU_NELKUL.has(a.elsoSzegmens ?? '');
}

export type FulKulcs = 'fooldal' | 'dosszie' | 'fotozas' | 'uzenetek' | 'fiok';

/** Aktív fül / menüpont az útvonalból (a telefonos alsó sáv és a gépes menü ugyanezt használja). */
export function aktivFulUtbol(p: string): FulKulcs {
  if (p.startsWith('/dosszie') || p.startsWith('/szamla') || p.startsWith('/tetel')) return 'dosszie';
  if (p.startsWith('/fotozas') || p.startsWith('/feltoltes')) return 'fotozas';
  if (p.startsWith('/fiok') || p.startsWith('/gyik') || p.startsWith('/ertesitesek')) return 'fiok';
  if (p.startsWith('/uzenetek')) return 'uzenetek';
  return 'fooldal';
}

/** A menü sorrendje és útvonalai (a „Fotózás” felirat gépen is marad – tulaj 11-20). */
export const MENU_UTAK: Readonly<Record<FulKulcs, string>> = {
  fooldal: '/',
  dosszie: '/dosszie',
  fotozas: '/fotozas',
  uzenetek: '/uzenetek',
  fiok: '/fiok',
};

/** Bekötés alatt a Főoldal a bekötési listára visz (ugyanaz, mint az alsó sávban). */
export function menuCel(kulcs: FulKulcs, korlatozott: boolean): string {
  return kulcs === 'fooldal' && korlatozott ? '/bekotes' : MENU_UTAK[kulcs];
}
