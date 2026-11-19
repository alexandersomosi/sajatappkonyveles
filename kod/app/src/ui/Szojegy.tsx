// Szóvédjegy (01): a lapos app-ikon (Geist Black K + kék tollvonás) és a név a tollvonással alatta.
// A név a brand.json-ból jön (EGYETLEN hely); az ikon betűje a név első betűje.
import { View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { brand } from '../config';
import { KEZVONAS_IKON, KEZVONAS_SZOJEGY } from '../theme/utak';
import { szin } from '../theme/tokens';
import { T } from './T';

export function AppIkon({ pt = 56, keret = true }: { pt?: number; keret?: boolean }) {
  const k = pt / 120;
  return (
    <View style={{ width: pt, height: pt, borderRadius: pt * 0.225, backgroundColor: szin.tintakek, borderWidth: keret ? 1 : 0, borderColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' }}>
      <T m={76 * k} s={900} c="#fff" lh={1} ls={-0.02} style={{ position: 'absolute', left: 0, right: 0, top: 22 * k, textAlign: 'center' }}>
        {brand.name.charAt(0).toLocaleUpperCase('hu-HU')}
      </T>
      <Svg width={pt} height={pt} viewBox="0 0 120 120" style={{ position: 'absolute', left: 0, top: 0 }}>
        <Path d={KEZVONAS_IKON} fill={szin.tollkekSavon} />
      </Svg>
    </View>
  );
}

export function Szojegy() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
      <AppIkon />
      <View style={{ paddingBottom: 12 }}>
        <T m={40} s={800} lh={1.05} ls={-0.04} c="#fff" accessibilityRole="header">
          {brand.name}
        </T>
        <Svg width={168} height={20} viewBox="0 0 220 26" preserveAspectRatio="none" style={{ position: 'absolute', left: -2, bottom: -3 }}>
          <Path d={KEZVONAS_SZOJEGY} fill={szin.tollkekSavon} />
        </Svg>
      </View>
    </View>
  );
}
