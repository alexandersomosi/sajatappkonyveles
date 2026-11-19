// Videók és útmutató-képek címe (SPEC §26.7.1): weben a saját hoston /media/, natívan a /config.mediaBaseUrl, ha az
// nincs, a MEDIA_FALLBACK_BASE_URL. MINTA buildben is /media/ (a helyi kiszolgáló a kod/media mappát adja).
import { Platform } from 'react-native';
import { MEDIA_FALLBACK_BASE_URL, MEDIA_WEB_BASE } from '../_shared/enums';

let alap: string = Platform.OS === 'web' ? MEDIA_WEB_BASE : MEDIA_FALLBACK_BASE_URL;

/** A /config válasza után (natívan) a szerver által adott címre vált. Weben mindig relatív marad. */
export function mediaAlapBeallit(url?: string | null) {
  if (Platform.OS === 'web' || !url) return;
  alap = url.endsWith('/') ? url : `${url}/`;
}
export function mediaUrl(fajl: string): string {
  return alap + fajl.replace(/^\/+/, '');
}
