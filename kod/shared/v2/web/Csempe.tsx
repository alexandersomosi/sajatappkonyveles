// Adózz.hu v2 – „Csempe” webes Reactben: tartalmi ikon semleges, lekerekített négyzeten (#F1F3F9).
// A méretet a v2.css osztályai adják (.v2-csempe, .v2-csempe-kicsi, .v2-csempe-nagy) – a web/v2.css-t egyszer be kell tölteni.
import { memo, type CSSProperties } from 'react';
import type { EmojiNev } from '../ikon/emoji-adat';
import type { IkonValtozat } from '../ikon/tipusok';
import { csempe, type CsempeMeret } from '../tokenek';
import { Ikon } from './Ikon';

export interface CsempeProps {
  nev: EmojiNev;
  meret?: CsempeMeret;
  /** Felolvasói címke; általában nem kell, mert mellette ott a szöveg (akkor díszítés). */
  label?: string;
  valtozat?: IkonValtozat;
  className?: string;
  style?: CSSProperties;
}

function CsempeAlap({ nev, meret = 'alap', label, valtozat, className, style }: CsempeProps) {
  const osztaly = `v2-csempe${meret === 'alap' ? '' : ` v2-csempe-${meret}`}${className ? ` ${className}` : ''}`;
  return (
    <span className={osztaly} style={style} {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}>
      <Ikon nev={nev} pt={csempe[meret].ikon} valtozat={valtozat} />
    </span>
  );
}

export const Csempe = memo(CsempeAlap);
