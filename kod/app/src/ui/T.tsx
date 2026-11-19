// Szöveg: Geist a pontos dizájn-súlyban; a dinamikus betűméretet 130%-ig követi (SPEC §3.5).
import { Children, type ReactNode } from 'react';
import { Platform, Text, type TextProps, type TextStyle } from 'react-native';
import { betu, szamok, szin, type Suly } from '../theme/tokens';

export interface TProps extends TextProps {
  m?: number; // betűméret pt
  s?: Suly; // súly
  c?: string; // szín
  lh?: number; // sormagasság szorzó (CSS line-height)
  ls?: number; // betűköz em-ben
  kozep?: boolean;
  jobb?: boolean;
  szam?: boolean; // táblázatos számjegyek
  alahuz?: boolean;
  /** Exact text, no invisible joiners (codes, IBANs, anything the user copies by hand). */
  nyers?: boolean;
  children?: ReactNode;
}

const KOTOTT = /(\d%?|NAV|ÁFA|SZJA|TB|Ft)-(?=[A-Za-zÁÉÍÓÖŐÚÜŰáéíóöőúüű])/g;
/** A számhoz/rövidítéshez kötött toldalék előtt nem tör sort: „10-ig”, „18,5%-a”, „NAV-nál”. */
// \u2026\u00e9s az \u00f6sszeg meg a \u201eFt\u201d k\u00f6z\u00f6tt sem (\u201e0 Ft\u201d egy sorban marad)
// …és az ezres tagolás szóköze sem („havi 19 999 Ft” nem törik „19 | 999”-re).
const javit = (x: string) =>
  x.replace(KOTOTT, '$1-\u2060').replace(/(\d) (?=\d{3}(?!\d))/g, '$1\u00a0').replace(/(\d) Ft\b/g, '$1\u00a0Ft').replace(/^ Ft\b/, '\u00a0Ft');
function tordel(c: ReactNode): ReactNode {
  if (typeof c === 'string') return javit(c);
  if (Array.isArray(c)) return Children.map(c, (x) => (typeof x === 'string' ? javit(x) : x));
  return c;
}

export function T({ m = 16, s = 400, c = szin.tinta, lh = 1.5, ls, kozep, jobb, szam, alahuz, nyers, style, children, ...p }: TProps) {
  const st: TextStyle = {
    ...betu(s),
    fontSize: m,
    lineHeight: Math.round(m * lh * 10) / 10,
    color: c,
    ...(ls ? { letterSpacing: m * ls } : null),
    ...(kozep ? { textAlign: 'center' as const } : jobb ? { textAlign: 'right' as const } : null),
    ...(alahuz ? { textDecorationLine: 'underline' as const, textDecorationColor: c } : null),
    // TERV G4: 1 px-es aláhúzás 4 px-re a szövegtől (weben CSS-ként megy át; natívan a rendszeré marad).
    ...(alahuz && Platform.OS === 'web' ? ({ textUnderlineOffset: 4, textDecorationThickness: 1 } as object) : null),
  };
  return (
    <Text maxFontSizeMultiplier={1.3} {...p} style={[st, szam ? szamok : null, style]}>
      {nyers ? children : tordel(children)}
    </Text>
  );
}
