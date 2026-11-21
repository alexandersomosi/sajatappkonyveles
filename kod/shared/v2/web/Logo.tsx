// Adózz.hu v2 – a felirat-logó webes Reactben (kép, Poppins nélkül). A Vite a képet saját fájlként adja ki
// (panel: assetsInlineLimit 0), így a CSP `img-src 'self'` mellett is megy.
import type { CSSProperties } from 'react';
import KEK from '../logo/logo.png';
import FEHER from '../logo/logo_feher.png';
import { LOGO_ALT, logoMeret } from '../logo/meret';

export interface LogoProps {
  /** Betűméret px-ben, mint a v2.js `data-meret` (alap: 30). */
  meret?: number;
  /** Fehér felirat sárga „zz”-vel – kék alapra. Alap: kék felirat. */
  feher?: boolean;
  /** Az alt szöveg (alap: „Adózz.hu”). Linkben a link célja is mehet ide, pl. „Adózz.hu – Főoldal”. */
  alt?: string;
  className?: string;
  style?: CSSProperties;
}

export function Logo({ meret = 30, feher = false, alt = LOGO_ALT, className, style }: LogoProps) {
  const m = logoMeret(meret, feher);
  return (
    <img
      src={feher ? FEHER : KEK}
      width={m.width}
      height={m.height}
      alt={alt}
      className={`v2-logo${className ? ` ${className}` : ''}`}
      style={style}
      draggable={false}
      decoding="async"
    />
  );
}
