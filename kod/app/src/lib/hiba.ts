// Hibaüzenet a felhasználónak: a saját (magyar) üzeneteinket átengedjük, a böngésző/rendszer nyers angol
// szövegét (pl. „Failed to fetch”, „Network request failed”) soha nem mutatjuk, helyette a hívó alapszövegét.
// Ha a szerver mezőhibát ad (400 + fields), és a képernyő ezeket a mezőket nem jelöli pirossal, a mező saját
// üzenetét adjuk vissza (pl. „Ebben a PDF-ben nem találunk elektronikus aláírást…”), nem az általános
// „Néhány adat nem stimmel…” mondatot, amiből a felhasználó nem tudja, mi a baj.
import { ApiHiba } from '../api/http';

const CSAK_ASCII = /^[\x00-\x7F]*$/;

export function hibaUzenet(e: unknown, alap: string, opt: { jelolt?: string[] } = {}): string {
  if (e instanceof ApiHiba) {
    const mezok = Object.entries(e.fields ?? {}).filter(([k, v]) => typeof v === 'string' && v.trim() && !(opt.jelolt ?? []).includes(k));
    if (mezok.length) return [...new Set(mezok.map(([, v]) => v.trim()))].join(' ');
    return e.message || alap;
  }
  if (e instanceof Error) {
    if (e.name === 'TypeError' || e.name === 'AbortError' || !e.message || CSAK_ASCII.test(e.message)) return alap;
    return e.message;
  }
  return alap;
}
