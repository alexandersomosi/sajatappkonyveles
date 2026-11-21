// A szerver DEMO módja (config.demo / home.demo) és a MINTA build: minden képernyőn látszó jelzés. v2: sárga „DEMO” pirula
// a kék fejléc jobb felső sarkában (gépen a hős sáv sarkában); fejléc nélküli képernyőn a keret rajzolja (keret.tsx MintaJel).
import { useEffect, useState } from 'react';
import { View, type StyleProp, type ViewStyle } from 'react-native';
import { MINTA_MOD } from '../config';
import { szin } from '../theme/tokens';
import { T } from './T';

let demoJel = false;
const demoFigyelok = new Set<(b: boolean) => void>();

/** A szerver DEMO módját (config.demo / home.demo) itt jelezzük minden képernyőn. */
export function demoBeallit(b: boolean) {
  if (b === demoJel) return;
  demoJel = b;
  demoFigyelok.forEach((f) => f(b));
}

export function useDemo(): boolean {
  const [demo, setDemo] = useState(demoJel);
  useEffect(() => {
    demoFigyelok.add(setDemo);
    setDemo(demoJel);
    return () => {
      demoFigyelok.delete(setDemo);
    };
  }, []);
  return MINTA_MOD || demo;
}

/** A sárga DEMO/MINTA pirula (sötét felirat sárgán: 11,74:1). */
export function DemoPirula({ style, kicsi }: { style?: StyleProp<ViewStyle>; kicsi?: boolean }) {
  const demo = useDemo();
  if (!demo) return null;
  return (
    <View
      style={[{ height: kicsi ? 24 : 30, paddingHorizontal: kicsi ? 10 : 13, borderRadius: 999, backgroundColor: szin.sarga, justifyContent: 'center', alignSelf: 'center' }, style]}
      accessibilityLabel={MINTA_MOD ? 'Minta mód: kitalált adatok, szerver nélkül' : 'Demó mód: nem valódi fizetés és adat'}
    >
      <T m={kicsi ? 11.5 : 12.5} s={800} lh={1.2} c={szin.sotet} ls={0.06} maxFontSizeMultiplier={1.2}>
        {MINTA_MOD ? 'MINTA' : 'DEMO'}
      </T>
    </View>
  );
}
