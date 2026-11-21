// Adózz.hu v2 – „Csempe”: tartalmi ikon semleges, lekerekített négyzeten (#F1F3F9).
// Méretek (tulaj 11-20: nagyobb ikon, ugyanakkora csempe): kicsi 36/29 (r 11), alap 42/34 (r 13), nagy 64/50 (r 20).
import { memo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import type { EmojiNev } from '../ikon/emoji-adat';
import type { IkonValtozat } from '../ikon/tipusok';
import { csempe, type CsempeMeret } from '../tokenek';
import { a11yKep } from './a11y';
import { Ikon } from './Ikon';

export interface CsempeProps {
  nev: EmojiNev;
  meret?: CsempeMeret;
  /** Felolvasói címke; általában nem kell, mert mellette ott a szöveg (akkor díszítés). */
  label?: string;
  valtozat?: IkonValtozat;
  style?: StyleProp<ViewStyle>;
}

/** A csempe doboz-stílusa (ha valaki saját tartalmat tenne bele). */
export function csempeStilus(meret: CsempeMeret = 'alap'): ViewStyle {
  const m = csempe[meret];
  return {
    width: m.meret,
    height: m.meret,
    borderRadius: m.sugar,
    backgroundColor: csempe.hatter,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  };
}

function CsempeAlap({ nev, meret = 'alap', label, valtozat, style }: CsempeProps) {
  return (
    <View style={[csempeStilus(meret), style]} {...a11yKep(label)}>
      <Ikon nev={nev} pt={csempe[meret].ikon} valtozat={valtozat} />
    </View>
  );
}

export const Csempe = memo(CsempeAlap);
