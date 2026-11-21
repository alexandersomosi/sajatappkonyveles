// Adózz.hu v2 – tartalmi ikon (Microsoft Fluent Emoji Flat) webes Reactben (panel, konzol).
// Ugyanabból az adatból rajzol, mint az RN-változat (ikon/emoji-adat.ts, KOZEPRE-javítással) – a kép azonos.
import { memo, type CSSProperties } from 'react';
import { EMOJI_ADAT, SZURKE_TABLA, VILAGOS_TABLA, type EmojiNev } from '../ikon/emoji-adat';
import type { IkonAdat, IkonValtozat } from '../ikon/tipusok';

export interface IkonProps {
  nev: EmojiNev;
  /** Méret CSS px-ben (alap: 34 – a csempe ikonja). */
  pt?: number;
  /** Felolvasói címke. Ha nincs, az ikon díszítés (aria-hidden). */
  label?: string;
  /** `szurke`: beviteli mezőben; `vilagos`: a kék fejléc / hős sáv háttérrajza. */
  valtozat?: IkonValtozat;
  className?: string;
  style?: CSSProperties;
}

/** A felolvasó-kellékek: címkével `role="img"`, nélküle rejtett. A fókuszba nem kerül (`focusable="false"`). */
export type SvgA11y = { role: 'img'; 'aria-label': string; focusable: 'false' } | { 'aria-hidden': true; focusable: 'false' };
export function svgA11y(label?: string): SvgA11y {
  return label ? { role: 'img', 'aria-label': label, focusable: 'false' } : { 'aria-hidden': true, focusable: 'false' };
}

/** Belső: egy IkonAdat kirajzolása (az Ikon és a GoogleG közös része). */
export function SvgRajz({ adat, pt, valtozat = 'szines', label, className, style }: { adat: IkonAdat; pt: number; valtozat?: IkonValtozat; label?: string; className?: string; style?: CSSProperties }) {
  const t = valtozat === 'szurke' ? SZURKE_TABLA : valtozat === 'vilagos' ? VILAGOS_TABLA : null;
  const f = (szin: string) => (t ? t[szin] ?? szin : szin);
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={adat.vb} width={pt} height={pt} className={className} style={style} {...svgA11y(label)}>
      {adat.elemek.map((e, i) =>
        e.t === 'p' ? (
          <path key={i} d={e.d} fill={f(e.f)} fillRule={e.eo ? 'evenodd' : undefined} />
        ) : (
          <rect key={i} x={e.x} y={e.y} width={e.w} height={e.h} rx={e.rx} fill={f(e.f)} />
        ),
      )}
    </svg>
  );
}

function IkonAlap({ nev, pt = 34, label, valtozat = 'szines', className, style }: IkonProps) {
  return <SvgRajz adat={EMOJI_ADAT[nev]} pt={pt} valtozat={valtozat} label={label} className={`v2-ikon${className ? ` ${className}` : ''}`} style={style} />;
}

export const Ikon = memo(IkonAlap);
