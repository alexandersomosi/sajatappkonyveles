// A könyvelő havi levele: 4 pt-os sarkú papír, halk papírszál, megszólítás, kék tollal írt aláírás (G7, 03).
// Az aláírás első megnyitáskor balról jobbra „íródik ki” (~900 ms); csökkentett mozgásnál azonnal látszik.
import { useEffect, useRef } from 'react';
import { Animated, Easing, Image, View } from 'react-native';
import { KEPERNYOKEP, mozgasKi } from '../lib/mozgas';
import Svg, { Path } from 'react-native-svg';
import type { Letter } from '../_shared/api';
import { datum } from '../lib/format';
import { arnyek, forma, szin } from '../theme/tokens';
import { KeszJel } from './kepek';
import { T } from './T';

const PAPIR = require('../../assets/textura/papirszal.png');

let mitLattunk = new Set<string>();

export function Alairas({ ut, kulcs, szelesseg = 120 }: { ut: string; kulcs: string; szelesseg?: number }) {
  const magassag = (szelesseg * 78) / 210;
  const elso = !mitLattunk.has(kulcs) && !KEPERNYOKEP;
  // balról jobbra feltáró keret (a kitöltött tollvonás-körvonal „íródik ki”); SVG-animáció nélkül, minden platformon megy
  const w = useRef(new Animated.Value(elso ? 0 : szelesseg)).current;
  useEffect(() => {
    if (!elso) return;
    mitLattunk.add(kulcs);
    let el = true;
    mozgasKi().then((rm) => {
        if (!el) return;
        if (rm) w.setValue(szelesseg);
        else Animated.timing(w, { toValue: szelesseg, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: false }).start();
      });
    return () => {
      el = false;
    };
  }, [elso, kulcs, szelesseg, w]);
  return (
    <View style={{ width: szelesseg, height: magassag }} accessibilityLabel="A könyvelőd aláírása">
      <Animated.View style={{ width: w, height: magassag, overflow: 'hidden' }}>
        <Svg width={szelesseg} height={magassag} viewBox="0 0 210 78">
          <Path d={ut} fill={szin.tollkek} />
        </Svg>
      </Animated.View>
    </View>
  );
}

export function Level({ level, alairasUt, befizetve, style }: { level: Letter; alairasUt: string | null; befizetve?: boolean; style?: object }) {
  return (
    <View style={[{ borderRadius: forma.level, backgroundColor: szin.levelPapir, ...arnyek.papir }, style]}>
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, borderRadius: forma.level, overflow: 'hidden' }}>
        <Image source={PAPIR} resizeMode="repeat" style={{ width: '100%', height: '100%', opacity: 0.5 }} />
      </View>
      <View style={{ paddingTop: 16, paddingHorizontal: 20, paddingBottom: 10 }}>
        <T m={26} s={600} lh={1.15} ls={-0.022} accessibilityRole="header" style={{ paddingRight: befizetve ? 52 : 0 }}>
          {level.greeting}
        </T>
        <T m={16.5} lh={1.62} style={{ marginTop: 8 }}>
          {level.body}
        </T>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: 10, marginTop: 4 }}>
          <View style={{ flexShrink: 1 }}>
            <T m={15} s={600} lh={1.3}>
              {level.signedBy}
            </T>
            <T m={14} lh={1.35} c={szin.halvany}>
              {level.signedRole}, {datum(level.date).replace(/\.$/, '.')}
            </T>
          </View>
          {alairasUt ? (
            <View style={{ marginRight: -4, marginBottom: -3 }}>
              <Alairas ut={alairasUt} kulcs={level.date} />
            </View>
          ) : null}
        </View>
      </View>
      {befizetve ? (
        <View style={{ position: 'absolute', right: 16, top: 14 }}>
          <KeszJel pt={44} label="Befizetve" />
        </View>
      ) : null}
    </View>
  );
}

/** Tesztekhez: az aláírás-animáció „látott” állapotának törlése. */
export function alairasNullaz() {
  mitLattunk = new Set();
}
