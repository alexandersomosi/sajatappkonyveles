// Csökkentett mozgás (SPEC §3.5, k8 4. fejezet): a rendszerbeállítás (natívan AccessibilityInfo, weben a
// prefers-reduced-motion) szerint, és a képernyőképeknél (?szelesseg=… vagy ?kepernyokep=1) mindig – a fej nélküli Chrome
// virtuális ideje alatt a requestAnimationFrame-alapú animációk nem futnak le.
import { useEffect, useState } from 'react';
import { AccessibilityInfo, Easing, Platform } from 'react-native';
import { GORBE, mozgasKiLogika } from './mozgasIdo';
import { KEPERNYOKEP_MOD } from './webkeret';

export { MOZGAS_IDO, BENYOMODAS, beuszasKesleltetes, porgoErtek } from './mozgasIdo';

export const KEPERNYOKEP = KEPERNYOKEP_MOD;

/** Natívan a natív szálon fut (useNativeDriver), weben ugyanaz a kód CSS-transzformként. */
export const NATIV_MEGHAJTO = Platform.OS !== 'web';

/** A v2 mozgásgörbéje: cubic-bezier(0.22, 1, 0.36, 1). */
export const gorbe = Easing.bezier(GORBE[0], GORBE[1], GORBE[2], GORBE[3]);

function webCsokkentett(): boolean | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.matchMedia) return null;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return null;
  }
}

export async function mozgasKi(): Promise<boolean> {
  if (KEPERNYOKEP) return true;
  const w = webCsokkentett();
  if (w !== null) return mozgasKiLogika({ kepernyokep: false, rendszerCsokkentett: w });
  try {
    return mozgasKiLogika({ kepernyokep: false, rendszerCsokkentett: await AccessibilityInfo.isReduceMotionEnabled() });
  } catch {
    return false;
  }
}

// A legutóbb ismert állapot: az első kirajzolásnál is jó értékkel indulunk (nincs „egy kocka mozgás”).
let ismert: boolean = KEPERNYOKEP || webCsokkentett() === true;
const figyelok = new Set<(b: boolean) => void>();
let figyelve = false;
function figyel() {
  if (figyelve) return;
  figyelve = true;
  const beallit = (b: boolean) => {
    const uj = mozgasKiLogika({ kepernyokep: KEPERNYOKEP, rendszerCsokkentett: b });
    if (uj === ismert) return;
    ismert = uj;
    figyelok.forEach((f) => f(uj));
  };
  if (Platform.OS === 'web') {
    try {
      const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
      mq?.addEventListener?.('change', (e) => beallit(e.matches));
    } catch {
      /* régi böngésző: marad az első érték */
    }
    return;
  }
  void AccessibilityInfo.isReduceMotionEnabled().then(beallit).catch(() => undefined);
  AccessibilityInfo.addEventListener('reduceMotionChanged', beallit);
}

/** Igaz, ha most nem szabad mozogni (csökkentett mozgás vagy képernyőkép). A változást is követi. */
export function useMozgasKi(): boolean {
  const [ki, setKi] = useState(ismert);
  useEffect(() => {
    figyel();
    figyelok.add(setKi);
    setKi(ismert);
    return () => {
      figyelok.delete(setKi);
    };
  }, []);
  return ki;
}

/** Szinkron lekérdezés (eseménykezelőben, ahol hookot nem lehet hívni). */
export function mozgasKiMost(): boolean {
  figyel();
  return ismert;
}
