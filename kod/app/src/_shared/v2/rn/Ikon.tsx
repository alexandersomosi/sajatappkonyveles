// GENERATED from kod/shared/v2 – do not edit here. Edit kod/shared/v2 and re-run sync-v2.
// Adózz.hu v2 – tartalmi ikon (Microsoft Fluent Emoji Flat) React Native-ben (react-native-svg).
// Kész adatból rajzol (ikon/emoji-adat.ts, KOZEPRE-javítással) – futásidőben nincs XML-elemzés.
import { memo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { EMOJI_ADAT, SZURKE_TABLA, VILAGOS_TABLA, type EmojiNev } from '../ikon/emoji-adat';
import type { IkonAdat, IkonValtozat } from '../ikon/tipusok';
import { a11yKep } from './a11y';

export interface IkonProps {
  nev: EmojiNev;
  /** Méret pontban (alap: 34 – a csempe ikonja). */
  pt?: number;
  /** Felolvasói címke. Ha nincs, az ikon díszítés (rejtett). */
  label?: string;
  /** `szurke`: beviteli mezőben (a minta grayscale(1)-e); `vilagos`: a kék fejléc háttérrajza. */
  valtozat?: IkonValtozat;
  style?: StyleProp<ViewStyle>;
}

function tabla(valtozat: IkonValtozat): Readonly<Record<string, string>> | null {
  return valtozat === 'szurke' ? SZURKE_TABLA : valtozat === 'vilagos' ? VILAGOS_TABLA : null;
}

/** Belső: egy IkonAdat kirajzolása (az Ikon és a GoogleG közös része). */
export function SvgRajz({ adat, pt, valtozat = 'szines' }: { adat: IkonAdat; pt: number; valtozat?: IkonValtozat }) {
  const t = tabla(valtozat);
  const f = (szin: string) => (t ? t[szin] ?? szin : szin);
  return (
    <Svg width={pt} height={pt} viewBox={adat.vb}>
      {adat.elemek.map((e, i) =>
        e.t === 'p' ? (
          <Path key={i} d={e.d} fill={f(e.f)} fillRule={e.eo ? 'evenodd' : 'nonzero'} />
        ) : (
          <Rect key={i} x={e.x} y={e.y} width={e.w} height={e.h} rx={e.rx} fill={f(e.f)} />
        ),
      )}
    </Svg>
  );
}

function IkonAlap({ nev, pt = 34, label, valtozat = 'szines', style }: IkonProps) {
  return (
    <View style={[{ width: pt, height: pt }, style]} {...a11yKep(label)}>
      <SvgRajz adat={EMOJI_ADAT[nev]} pt={pt} valtozat={valtozat} />
    </View>
  );
}

export const Ikon = memo(IkonAlap);
