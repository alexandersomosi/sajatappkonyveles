// Weben a telefonos elrendezés középre kerül, legfeljebb 480 pt szélesen. A képernyőképekhez (scripts/kepek.mjs) a
// ?szelesseg=390 paraméter pontosan 390 pt-ra rögzíti, balra igazítva (a fej nélküli Chrome ablaka nem lehet ilyen keskeny).
import { Platform } from 'react-native';

function olvas(): number | null {
  if (Platform.OS !== 'web' || typeof location === 'undefined') return null;
  try {
    const n = Number(new URLSearchParams(location.search).get('szelesseg'));
    return n >= 320 && n <= 480 ? n : null;
  } catch {
    return null;
  }
}
export const KERET_SZELESSEG = olvas();
export const keretStilus = KERET_SZELESSEG
  ? ({ width: KERET_SZELESSEG, alignSelf: 'flex-start' } as const)
  : ({ width: '100%', maxWidth: 480 } as const);
