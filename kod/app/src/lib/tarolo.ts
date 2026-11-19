// Tárolás. Titok (frissítő token) natívan csak a secure-store-ba kerül; weben a frissítő token HttpOnly sütiben van
// (a JS nem is látja), ezért ott nincs mit tárolni. Nem titkos beállítás weben localStorage-ba (try/catch).
import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

const memoria = new Map<string, string>();

export async function titokOlvas(kulcs: string): Promise<string | null> {
  if (Platform.OS === 'web') return memoria.get(kulcs) ?? null;
  try {
    return await SecureStore.getItemAsync(kulcs);
  } catch {
    return null;
  }
}
export async function titokIr(kulcs: string, ertek: string | null): Promise<void> {
  if (Platform.OS === 'web') {
    if (ertek === null) memoria.delete(kulcs);
    else memoria.set(kulcs, ertek);
    return;
  }
  try {
    if (ertek === null) await SecureStore.deleteItemAsync(kulcs);
    else await SecureStore.setItemAsync(kulcs, ertek, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  } catch {
    /* nem sikerült tárolni: a következő indításkor újra be kell lépni */
  }
}

/** Nem titkos beállítás (pl. biometrikus zár be/ki). */
export async function beallitasOlvas(kulcs: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return typeof localStorage !== 'undefined' ? localStorage.getItem(kulcs) : null;
    } catch {
      return null;
    }
  }
  return titokOlvas(kulcs);
}
export async function beallitasIr(kulcs: string, ertek: string | null): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      if (typeof localStorage === 'undefined') return;
      if (ertek === null) localStorage.removeItem(kulcs);
      else localStorage.setItem(kulcs, ertek);
    } catch {
      /* privát ablak */
    }
    return;
  }
  return titokIr(kulcs, ertek);
}
