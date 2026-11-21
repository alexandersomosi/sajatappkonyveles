// GENERATED from kod/shared/v2 – do not edit here. Edit kod/shared/v2 and re-run sync-v2.
// Adózz.hu v2 – egyszínű vezérlő-ikon (Material Icons útvonalak + a saját chev nyíl) React Native-ben.
import { memo } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { VEZERLO_ADAT, VEZERLO_VB, type VezerloNev } from '../ikon/material';
import { szin as SZIN } from '../tokenek';
import { a11yKep } from './a11y';

export interface VezerloIkonProps {
  nev: VezerloNev;
  /** Méret pontban (alap: 24). */
  pt?: number;
  /** Szín (alap: sötét #10152B). A chev nyíl a mintában #9AA2B5 (`szin.dekorNyil`). */
  szin?: string;
  label?: string;
  style?: StyleProp<ViewStyle>;
}

function VezerloIkonAlap({ nev, pt = 24, szin = SZIN.sotet, label, style }: VezerloIkonProps) {
  const a = VEZERLO_ADAT[nev];
  return (
    <View style={[{ width: pt, height: pt }, style]} {...a11yKep(label)}>
      <Svg width={pt} height={pt} viewBox={VEZERLO_VB}>
        {a.vonal ? (
          <Path d={a.d} fill="none" stroke={szin} strokeWidth={a.vonal} strokeLinecap="round" strokeLinejoin="round" />
        ) : (
          <Path d={a.d} fill={szin} />
        )}
      </Svg>
    </View>
  );
}

export const VezerloIkon = memo(VezerloIkonAlap);
