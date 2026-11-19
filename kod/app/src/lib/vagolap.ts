// Vágólapra másolás ellenőrzött eredménnyel: ha az írás nem sikerül (a böngésző letiltotta, nincs engedély), a
// hívó NEM mondhatja, hogy „Kimásoltad” – különben a banki appba a vágólap korábbi tartalma kerülne.
import { Platform } from 'react-native';
import * as Clipboard from 'expo-clipboard';

export const MASOLAS_HIBA = 'Nem sikerült kimásolni. Jelöld ki, és másold kézzel.';

/** Weben saját út: az expo-clipboard tartalék ága (document.execCommand) akkor is „sikert” jelez, ha a böngésző
 *  a másolást megtagadta (az execCommand ilyenkor false-t ad vissza, nem dob hibát). */
async function webre(szoveg: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(szoveg);
      return true;
    }
  } catch {
    /* nincs engedély vagy nem biztonságos környezet: a régi módszerrel próbáljuk */
  }
  try {
    const mezo = document.createElement('textarea');
    mezo.value = szoveg;
    mezo.setAttribute('readonly', '');
    mezo.style.position = 'fixed';
    mezo.style.opacity = '0';
    document.body.appendChild(mezo);
    mezo.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(mezo);
    return ok === true;
  } catch {
    return false;
  }
}

/** true, ha a szöveg biztosan a vágólapon van. */
export async function vagolapra(szoveg: string): Promise<boolean> {
  if (Platform.OS === 'web') return webre(szoveg);
  try {
    return (await Clipboard.setStringAsync(szoveg)) !== false;
  } catch {
    return false;
  }
}
