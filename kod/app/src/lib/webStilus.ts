// k8 (web): néhány globális CSS-szabály, amit az RN-stílus nem tud kifejezni. A CSP (style-src 'unsafe-inline') engedi –
// a react-native-web is így tölti be a stílusait.
// - Látható fókusz billentyűs bejáráskor: 2 px #1428DB körvonal, 2 px eltolással (v2 tokenek: fokusz); a közte lévő 2 px
//   fehér gyűrű (box-shadow), így a kék hős sávon is látszik (k8 látvány 3: kettős gyűrű, fehér + kék).
// - Csökkentett mozgás: minden CSS-átmenet és -animáció ki (a JS-mozgásokat a useMozgasKi kapcsolja ki).
// - Mutató kurzor a gombokon/linkeken (gépen).
import { Platform } from 'react-native';
import { fokusz } from '../_shared/v2/tokenek';

const CSS = `
:focus { outline: none; }
:focus-visible { outline: ${fokusz.vastagsag}px solid ${fokusz.szin} !important; outline-offset: ${fokusz.eltolas}px !important; box-shadow: 0 0 0 ${fokusz.eltolas}px #FFFFFF !important; }
input:focus-visible, textarea:focus-visible { outline: none !important; }
[role="button"], [role="link"], [role="tab"], [role="checkbox"], [role="radio"], [role="switch"], a { cursor: pointer; }
[aria-disabled="true"] { cursor: default; }
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { transition-duration: 0.01ms !important; animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; scroll-behavior: auto !important; }
}
`;

let kesz = false;
export function webStilusBetolt() {
  if (kesz || Platform.OS !== 'web' || typeof document === 'undefined') return;
  kesz = true;
  try {
    const s = document.createElement('style');
    s.id = 'adozz-v2-globalis';
    s.textContent = CSS;
    document.head.appendChild(s);
  } catch {
    /* nincs DOM (pl. statikus előrenderelés) */
  }
}
