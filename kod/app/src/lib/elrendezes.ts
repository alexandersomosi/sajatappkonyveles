// k8 gépes nézet: a töréspont hookjai (a tiszta logika: lib/elrendezesLogika.ts). Natívan (telefon, tablet) mindig
// telefonos; weben ≥ 1024 pt-tól gépes (bal menü, hős sáv, kártyarács); a `?szelesseg=390` képernyőkép mindig telefonos.
import { createContext, useContext } from 'react';
import { Platform, useWindowDimensions } from 'react-native';
import { asztaliE, menuSzelesseg, szelesAsztaliE, tartalomMargo } from './elrendezesLogika';
import { KERET_SZELESSEG } from './webkeret';

export function useAsztali(): boolean {
  const { width } = useWindowDimensions();
  return asztaliE({ web: Platform.OS === 'web', szelesseg: width, keretSzelesseg: KERET_SZELESSEG });
}

export function useSzelesAsztali(): boolean {
  const { width } = useWindowDimensions();
  return szelesAsztaliE({ web: Platform.OS === 'web', szelesseg: width, keretSzelesseg: KERET_SZELESSEG });
}

/** A gépes elrendezés méretei (menü, margók) az ablak szélességéből. */
export function useAsztaliMeretek() {
  const { width } = useWindowDimensions();
  return { menu: menuSzelesseg(width), margo: tartalomMargo(width), szeles: width >= 1360 };
}

/** Igaz, ha a gyökér-elrendezés épp a bal menüt mutatja (a képernyők ehhez igazítják a fülsort/dokkot). */
export const OldalsavCtx = createContext(false);
export const useOldalsav = () => useContext(OldalsavCtx);
