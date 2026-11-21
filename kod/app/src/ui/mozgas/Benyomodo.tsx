// k8 mozgás #4 (+ #11 gépen): gombnyomásra enyhe benyomódás (scale 1 → 0,97: le 100 ms, fel 200 ms), natívan a natív
// szálon (Animated, useNativeDriver), weben ugyanaz a kód. Csökkentett mozgásnál nincs skála, csak a nyomott szín.
// A külső Animated.View kapja a hívó elrendezési stílusát (margó, igazítás, flex, szélesség, pozíció), a belső Pressable a
// kinézetet – így a gombok aláírása és elrendezése változatlan marad.
import { useRef, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, type PressableProps, type PressableStateCallbackType, type StyleProp, type ViewStyle } from 'react-native';
import { BENYOMODAS, MOZGAS_IDO, NATIV_MEGHAJTO, gorbe, mozgasKiMost } from '../../lib/mozgas';

const KULSO = new Set([
  'margin', 'marginTop', 'marginBottom', 'marginLeft', 'marginRight', 'marginHorizontal', 'marginVertical', 'marginStart', 'marginEnd',
  'alignSelf', 'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'width', 'minWidth', 'maxWidth', 'position', 'top', 'left', 'right', 'bottom', 'zIndex',
]);

/** A hívó stílusát két részre bontja: elrendezés (kívül) és kinézet (belül). */
export function stilusBont(st: StyleProp<ViewStyle>): { kulso: ViewStyle; belso: ViewStyle } {
  const lapos = (StyleSheet.flatten(st) ?? {}) as Record<string, unknown>;
  const kulso: Record<string, unknown> = {};
  const belso: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(lapos)) (KULSO.has(k) ? kulso : belso)[k] = v;
  return { kulso: kulso as ViewStyle, belso: belso as ViewStyle };
}

export type NyomhatoStilus = StyleProp<ViewStyle> | ((s: PressableStateCallbackType & { hovered?: boolean; focused?: boolean }) => StyleProp<ViewStyle>);

/** Pressable benyomódással. `alap`: a kinézet (függvény is lehet: pressed/hovered/focused); `style`: a hívó stílusa. */
export function Nyomhato({ alap, style, children, onPressIn, onPressOut, alapIgazitas = 'stretch', ...p }: Omit<PressableProps, 'style' | 'children'> & {
  alap: NyomhatoStilus;
  style?: StyleProp<ViewStyle>;
  children: ReactNode | ((s: PressableStateCallbackType) => ReactNode);
  /** A gomb alapértelmezett igazítása, ha a hívó nem ad alignSelf-et (fő gomb: teljes szélesség, kis gomb: balra). */
  alapIgazitas?: ViewStyle['alignSelf'];
}) {
  const skala = useRef(new Animated.Value(1)).current;
  const { kulso, belso } = stilusBont(style);
  const mozog = (cel: number, ido: number) => {
    if (mozgasKiMost()) {
      skala.setValue(1);
      return;
    }
    Animated.timing(skala, { toValue: cel, duration: ido, easing: gorbe, useNativeDriver: NATIV_MEGHAJTO }).start();
  };
  return (
    <Animated.View style={[{ alignSelf: alapIgazitas }, kulso, { transform: [{ scale: skala }] }]}>
      <Pressable
        {...p}
        onPressIn={(e) => {
          if (!p.disabled) mozog(BENYOMODAS, MOZGAS_IDO.lenyomas);
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          mozog(1, MOZGAS_IDO.felengedes);
          onPressOut?.(e);
        }}
        style={(s) => [typeof alap === 'function' ? alap(s) : alap, belso]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}
