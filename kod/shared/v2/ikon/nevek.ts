// Adózz.hu v2 – ikonnevek, amelyekre a felületek hivatkoznak (React nélkül).
import type { EmojiNev } from './emoji-adat';

/** Az ügyfél-app fülei (telefonon az alsó sáv, gépen a bal menü) – a v2.js `nav` sorrendje és feliratai.
 *  A „Fotózás” felirat gépen is marad (tulaj 11-20). Az alsó sávban MINDEN ikon színes; az aktív fület a 3 px-es
 *  kék felső csík és a kék, 750-es felirat jelzi (tokenek.ts → nav). */
export const NAV_IKONOK: readonly { readonly kulcs: 'fooldal' | 'dosszie' | 'fotozas' | 'uzenetek' | 'fiok'; readonly ikon: EmojiNev; readonly felirat: string }[] = [
  { kulcs: 'fooldal', ikon: 'fooldal', felirat: 'Főoldal' },
  { kulcs: 'dosszie', ikon: 'dosszie', felirat: 'Dosszié' },
  { kulcs: 'fotozas', ikon: 'kamera', felirat: 'Fotózás' },
  { kulcs: 'uzenetek', ikon: 'uzenet', felirat: 'Üzenetek' },
  { kulcs: 'fiok', ikon: 'fiok', felirat: 'Fiók' },
];
