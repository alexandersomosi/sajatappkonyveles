// Keret-mérő (03 „Idei kereteid”): a mondat a cím; tömör = eddig, csíkozott = várhatóan év végéig.
import { useState } from 'react';
import { View } from 'react-native';
import Svg, { ClipPath, Defs, G, Line, Pattern, Rect } from 'react-native-svg';
import type { Meter } from '../_shared/api';
import { szam } from '../lib/format';
import { szin } from '../theme/tokens';
import { KeszJel } from './kepek';
import { T } from './T';

export function MeroSav({ arany, varhato }: { arany: number; varhato: number }) {
  const [w, setW] = useState(0);
  const a = Math.max(0, Math.min(1, arany));
  const v = Math.max(a, Math.min(1, varhato));
  return (
    <View
      onLayout={(e) => setW(e.nativeEvent.layout.width)}
      style={{ height: 10, marginTop: 14, marginBottom: 9 }}
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(a * 100) }}
    >
      {w > 0 && (
        <Svg width={w} height={10}>
          <Defs>
            <ClipPath id="sav">
              <Rect x={0} y={0} width={w} height={10} rx={5} />
            </ClipPath>
            <Pattern id="csik" patternUnits="userSpaceOnUse" width={5} height={5} patternTransform="rotate(45)">
              <Line x1={0} y1={0} x2={0} y2={5} stroke={szin.tintakek} strokeWidth={1.6} />
            </Pattern>
          </Defs>
          <G clipPath="url(#sav)">
            <Rect x={0} y={0} width={w} height={10} fill={szin.nyomott} />
            <Rect x={w * a} y={0} width={Math.max(0, w * (v - a))} height={10} fill="url(#csik)" opacity={0.75} />
            <Rect x={0} y={0} width={w * a} height={10} rx={5} fill={szin.tintakek} />
            <Rect x={0.5} y={0.5} width={w - 1} height={9} rx={4.5} fill="none" stroke={szin.hajszal} strokeWidth={1} />
          </G>
        </Svg>
      )}
    </View>
  );
}

export function Mero({ meter, mellek, balVeg, jobbVeg }: { meter: Meter; mellek: string; balVeg: string; jobbVeg: string }) {
  return (
    <View style={{ paddingTop: 17, paddingHorizontal: 18, paddingBottom: 16 }}>
      <T m={17} s={650} lh={1.4} ls={-0.01}>
        {meter.sentence}
      </T>
      <T m={15} lh={1.5} c={szin.halvany} style={{ marginTop: 3 }}>
        {(meter as Meter & { detail?: string }).detail ?? mellek}
      </T>
      <MeroSav arany={meter.ratio} varhato={meter.projectedHuf / meter.limitHuf} />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 12 }}>
        <T m={14.5} lh={1.35} szam>
          {balVeg}
        </T>
        <T m={14.5} lh={1.35} szam jobb>
          {jobbVeg}
        </T>
      </View>
      {meter.warning ? (
        <View style={{ marginTop: 12, borderRadius: 6, backgroundColor: szin.borostyanAlap, paddingVertical: 8, paddingHorizontal: 10 }}>
          <T m={14.5} s={600} c={szin.borostyanSzoveg} lh={1.4}>
            Közel vagy a határhoz. A könyvelőd szól, mielőtt bármit tenned kell.
          </T>
        </View>
      ) : null}
    </View>
  );
}

export function PipaMondat({ cim, mellek }: { cim: string; mellek: string }) {
  return (
    <View style={{ paddingTop: 17, paddingHorizontal: 18, paddingBottom: 16, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
      <KeszJel pt={24} />
      <View style={{ flex: 1 }}>
        <T m={17} s={650} lh={1.4} ls={-0.01}>
          {cim}
        </T>
        <T m={15} lh={1.5} c={szin.halvany} style={{ marginTop: 3 }}>
          {mellek}
        </T>
      </View>
    </View>
  );
}

/** Idei bevétel havonta (FUNKCIOK 9): egyszínű oszlopok, felirattal (dataviz-szabály: egy árnyalat, címkézett érték). */
export function BevetelOszlopok({ honapok: osszes0, ma }: { honapok: { month: number; amountHuf: number }[]; ma?: string }) {
  const most = ma ? Number(ma.slice(5, 7)) : 12;
  const honapok = osszes0.filter((h) => h.month <= most);
  const betu = ['J', 'F', 'M', 'Á', 'M', 'J', 'J', 'A', 'Sz', 'O', 'N', 'D'];
  const max = Math.max(1, ...honapok.map((h) => h.amountHuf));
  const rov = ['jan', 'febr', 'márc', 'ápr', 'máj', 'jún', 'júl', 'aug', 'szept', 'okt', 'nov', 'dec'];
  const legutobbi = honapok[honapok.length - 1];
  const osszes = honapok.reduce((a, b) => a + b.amountHuf, 0);
  return (
    <View style={{ paddingTop: 17, paddingHorizontal: 18, paddingBottom: 14 }}>
      <T m={17} s={650} lh={1.4} ls={-0.01}>
        Idén eddig {szam(osszes)} Ft bevételed jött be.
      </T>
      <T m={15} lh={1.5} c={szin.halvany} style={{ marginTop: 3 }}>
        Amikor a pénz megérkezett, abban a hónapban számít.
      </T>
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 104, marginTop: 14, gap: 4 }} accessibilityLabel={honapok.map((h) => `${rov[h.month - 1]}: ${szam(h.amountHuf)} forint`).join(', ')}>
        {honapok.map((h) => (
          <View key={h.month} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
            <View style={{ width: '100%', maxWidth: 22, height: Math.max(2, (h.amountHuf / max) * 84), borderRadius: 3, backgroundColor: h === legutobbi ? '#7C89E4' : szin.tintakek }} />
          </View>
        ))}
      </View>
      <View style={{ flexDirection: 'row', gap: 4, marginTop: 6 }}>
        {honapok.map((h) => (
          <T key={h.month} m={11} c={szin.halvany} kozep style={{ flex: 1 }} numberOfLines={1}>
            {betu[h.month - 1]}
          </T>
        ))}
      </View>
      {legutobbi ? (
        <T m={13.5} c={szin.halvany} lh={1.4} style={{ marginTop: 8 }}>
          A világosabb oszlop a mostani hónap ({rov[legutobbi.month - 1]}.): eddig {szam(legutobbi.amountHuf)} Ft.
        </T>
      ) : null}
    </View>
  );
}
