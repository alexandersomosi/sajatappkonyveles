// Teljes képernyős képnéző az útmutató-képekhez (SPEC §26.6.1): két ujjas nagyítás, dupla koppintás (1× ↔ 2,5×),
// húzással mozgatható, és nagy szöveges „Kisebb / Nagyobb” kapszulák is (idősebbeknek, egérrel is; jel-ikon nincs,
// TERV 0.). Alatta a képaláírás.
import { useRef, useState } from 'react';
import { Image, Modal, PanResponder, Platform, Pressable, ScrollView, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { forma, szin } from '../theme/tokens';
import { T } from './T';

const MIN = 1;
const MAX = 4;

export function KepNezo({ uri, szel, mag, felirat, cimke, alt, bezar }: { uri: string; szel: number; mag: number; felirat?: string; /** SPEC §27.1.2: „NAV-képernyő · Forrás: …” / „Rajzolt vázlat – …” */ cimke?: string; alt?: string; bezar: () => void }) {
  const ins = useSafeAreaInsets();
  const ablak = useWindowDimensions();
  const kepSzel = Math.min(ablak.width, 900);
  const [nagyitas, setNagyitas] = useState(1);
  const utolsoKoppintas = useRef(0);
  const csipes = useRef<{ tav: number; kezdo: number } | null>(null);
  const allit = (n: number) => setNagyitas(Math.max(MIN, Math.min(MAX, Math.round(n * 100) / 100)));

  const tav = (t: readonly { pageX: number; pageY: number }[]) => Math.hypot(t[0].pageX - t[1].pageX, t[0].pageY - t[1].pageY);
  const pr = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: (e) => e.nativeEvent.touches.length === 2,
      onMoveShouldSetPanResponder: (e) => e.nativeEvent.touches.length === 2,
      onPanResponderGrant: (e) => {
        const t = e.nativeEvent.touches;
        if (t.length === 2) csipes.current = { tav: tav(t), kezdo: nagyitasRef.current };
      },
      onPanResponderMove: (e) => {
        const t = e.nativeEvent.touches;
        if (t.length !== 2) return;
        if (!csipes.current) csipes.current = { tav: tav(t), kezdo: nagyitasRef.current };
        allit(csipes.current.kezdo * (tav(t) / Math.max(1, csipes.current.tav)));
      },
      onPanResponderRelease: () => {
        csipes.current = null;
      },
      onPanResponderTerminationRequest: () => false,
    }),
  ).current;
  const nagyitasRef = useRef(1);
  nagyitasRef.current = nagyitas;

  // 11-19 javító kör 2: 360 pt alatt kisebb kapszulák, hogy a százalék is kiférjen (320-on „1…” lett belőle)
  const szuk = ablak.width < 360;
  const px = szuk ? 10 : 14;
  const w = kepSzel * nagyitas;
  const h = (w * mag) / szel;
  return (
    <Modal visible animationType="fade" onRequestClose={bezar} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#0D1628', paddingTop: Platform.OS === 'web' ? 0 : ins.top, paddingBottom: Platform.OS === 'web' ? 0 : ins.bottom }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: szuk ? 6 : 8, paddingHorizontal: szuk ? 8 : 12, minHeight: 60 }}>
          <Pressable accessibilityRole="button" accessibilityLabel="Kisebb: kicsinyítés" disabled={nagyitas <= MIN} onPress={() => allit(nagyitas / 1.5)} style={{ height: 44, paddingHorizontal: px, borderRadius: forma.gomb, backgroundColor: 'rgba(255,255,255,0.14)', justifyContent: 'center', opacity: nagyitas <= MIN ? 0.4 : 1 }}>
            <T m={szuk ? 14.5 : 15.5} s={650} c="#fff" lh={1.2}>
              Kisebb
            </T>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Nagyobb: nagyítás" disabled={nagyitas >= MAX} onPress={() => allit(nagyitas * 1.5)} style={{ height: 44, paddingHorizontal: px, borderRadius: forma.gomb, backgroundColor: 'rgba(255,255,255,0.14)', justifyContent: 'center', opacity: nagyitas >= MAX ? 0.4 : 1 }}>
            <T m={szuk ? 14.5 : 15.5} s={650} c="#fff" lh={1.2}>
              Nagyobb
            </T>
          </Pressable>
          <T m={szuk ? 13 : 14} c={szin.fejlecHalvany} szam style={{ flex: 1, minWidth: 34 }} numberOfLines={1} accessibilityLiveRegion="polite">
            {`${Math.round(nagyitas * 100)}%`}
          </T>
          <Pressable accessibilityRole="button" onPress={bezar} style={{ height: 44, paddingHorizontal: szuk ? 12 : 18, borderRadius: forma.gomb, backgroundColor: '#fff', justifyContent: 'center' }}>
            <T m={16} s={700} c={szin.tintakek}>
              Bezár
            </T>
          </Pressable>
        </View>
        <View style={{ flex: 1 }} {...pr.panHandlers}>
          {nagyitas === 1 ? (
            // 1×: középre téve, görgetés nélkül (ha magasabb a képernyőnél, függőlegesen görgethető)
            <ScrollView contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Pressable
                  accessibilityRole="image"
                  accessibilityLabel={alt ?? felirat}
                  accessibilityHint="Dupla koppintással nagyíthatod"
                  onPress={() => {
                    const most = Date.now();
                    if (most - utolsoKoppintas.current < 320) allit(nagyitas > 1 ? 1 : 2.5);
                    utolsoKoppintas.current = most;
                  }}
                >
                  <Image source={{ uri }} style={{ width: w, height: h }} resizeMode="contain" />
                </Pressable>
            </ScrollView>
          ) : (
            <ScrollView>
              <ScrollView horizontal showsHorizontalScrollIndicator>
                <Pressable
                  accessibilityRole="image"
                  accessibilityLabel={alt ?? felirat}
                  accessibilityHint="Dupla koppintással nagyíthatod"
                  onPress={() => {
                    const most = Date.now();
                    if (most - utolsoKoppintas.current < 320) allit(nagyitas > 1 ? 1 : 2.5);
                    utolsoKoppintas.current = most;
                  }}
                >
                  <Image source={{ uri }} style={{ width: w, height: h }} resizeMode="contain" />
                </Pressable>
              </ScrollView>
            </ScrollView>
          )}
        </View>
        <View style={{ paddingHorizontal: 18, paddingVertical: 12, backgroundColor: 'rgba(0,0,0,0.35)' }}>
          {felirat ? (
            <T m={16} lh={1.45} c="#fff">
              {felirat}
            </T>
          ) : null}
          {cimke ? (
            <T m={13} lh={1.4} c="#fff" style={{ marginTop: felirat ? 4 : 0, opacity: 0.9 }}>
              {cimke}
            </T>
          ) : null}
          <T m={13.5} lh={1.4} c={szin.fejlecHalvany} style={{ marginTop: felirat || cimke ? 4 : 0 }}>
            Dupla koppintással vagy két ujjal is nagyíthatod.
          </T>
        </View>
      </View>
    </Modal>
  );
}
