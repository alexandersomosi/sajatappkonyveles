// Adózz.hu v2 – a színes Google „G” webes Reactben (a „Belépés Google-lel” gombhoz). Díszítés: a felirat mondja ki.
import type { CSSProperties } from 'react';
import { GOOGLE_G } from '../ikon/material';
import { SvgRajz } from './Ikon';

export function GoogleG({ pt = 20, label, className, style }: { pt?: number; label?: string; className?: string; style?: CSSProperties }) {
  return <SvgRajz adat={GOOGLE_G} pt={pt} label={label} className={className} style={style} />;
}
