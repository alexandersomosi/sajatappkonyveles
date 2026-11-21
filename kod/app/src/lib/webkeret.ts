// Weben a telefonos elrendezés középre kerül, legfeljebb 480 pt szélesen (k8: ≥ 1024 pt-tól gépes elrendezés, lásd
// lib/elrendezes.ts). A képernyőképekhez (scripts/kepek.mjs) a ?szelesseg=390 paraméter pontosan 390 pt-ra rögzíti, balra
// igazítva (a fej nélküli Chrome ablaka nem lehet ilyen keskeny); a ?kepernyokep=1 a gépes képeknél kapcsolja ki a mozgást.
import { Platform } from 'react-native';

function param(nev: string): string | null {
  if (Platform.OS !== 'web' || typeof location === 'undefined') return null;
  try {
    return new URLSearchParams(location.search).get(nev);
  } catch {
    return null;
  }
}

function olvas(): number | null {
  const n = Number(param('szelesseg'));
  return n >= 320 && n <= 480 ? n : null;
}
export const KERET_SZELESSEG = olvas();
/** Képernyőkép-mód: a mozgások kikapcsolva (telefonos és gépes képnél is). */
export const KEPERNYOKEP_MOD = KERET_SZELESSEG !== null || param('kepernyokep') === '1';
export const keretStilus = KERET_SZELESSEG
  ? ({ width: KERET_SZELESSEG, alignSelf: 'flex-start' } as const)
  : ({ width: '100%', maxWidth: 480 } as const);
