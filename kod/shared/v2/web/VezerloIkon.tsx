// Adózz.hu v2 – egyszínű vezérlő-ikon (Material Icons útvonalak + a saját chev nyíl) webes Reactben.
// A szín alapból `currentColor` (a gomb / link feliratának színe).
import { memo, type CSSProperties } from 'react';
import { VEZERLO_ADAT, VEZERLO_VB, type VezerloNev } from '../ikon/material';
import { svgA11y } from './Ikon';

export interface VezerloIkonProps {
  nev: VezerloNev;
  /** Méret CSS px-ben (alap: 24). */
  pt?: number;
  /** Szín (alap: currentColor). A chev nyíl a mintában #9AA2B5 (`szin.dekorNyil`). */
  szin?: string;
  label?: string;
  className?: string;
  style?: CSSProperties;
}

function VezerloIkonAlap({ nev, pt = 24, szin = 'currentColor', label, className, style }: VezerloIkonProps) {
  const a = VEZERLO_ADAT[nev];
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox={VEZERLO_VB} width={pt} height={pt} className={`v2-vezerlo${className ? ` ${className}` : ''}`} style={style} {...svgA11y(label)}>
      {a.vonal ? (
        <path d={a.d} fill="none" stroke={szin} strokeWidth={a.vonal} strokeLinecap="round" strokeLinejoin="round" />
      ) : (
        <path d={a.d} fill={szin} />
      )}
    </svg>
  );
}

export const VezerloIkon = memo(VezerloIkonAlap);
