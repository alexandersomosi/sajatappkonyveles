// Csökkentett mozgás (SPEC §3.5): a rendszerbeállítás szerint, és a képernyőképeknél (?szelesseg=…) mindig – a fej
// nélküli Chrome virtuális ideje alatt a requestAnimationFrame-alapú animációk nem futnak le.
import { AccessibilityInfo } from 'react-native';
import { KERET_SZELESSEG } from './webkeret';

export const KEPERNYOKEP = KERET_SZELESSEG !== null;

export async function mozgasKi(): Promise<boolean> {
  if (KEPERNYOKEP) return true;
  try {
    return await AccessibilityInfo.isReduceMotionEnabled();
  } catch {
    return false;
  }
}
