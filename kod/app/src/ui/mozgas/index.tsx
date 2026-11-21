// k8 mozgások (K8_VEGREHAJTAS 4. fejezet; csak az ügyfél-appban): React Native Animated, csak transform és opacity,
// natívan a natív szálon (useNativeDriver), weben ugyanaz a kód. 0,2–0,4 s, nincs folyamatos/ismétlődő mozgás; csökkentett
// mozgásnál (rendszer, böngésző, képernyőkép-mód) minden azonnal a végállapotban van. Új natív függőség nincs.
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Platform, View, type StyleProp, type ViewStyle } from 'react-native';
import * as Haptics from 'expo-haptics';
import { MOZGAS_IDO, NATIV_MEGHAJTO, beuszasKesleltetes, gorbe, porgoErtek, useMozgasKi } from '../../lib/mozgas';
import { szin } from '../../theme/tokens';
import { T, type TProps } from '../T';

export { Nyomhato, stilusBont } from './Benyomodo';

// ---------- 1. beúszás (főoldal kártyái, munkamenetenként egyszer) ----------
const latottBeuszas = new Set<string>();

/** Kártya beúszása: opacity 0→1, translateY 12→0, 300 ms, a `sorszam` szerint 50 ms-mal késleltetve (max. 6).
 *  A `kulcs` (pl. 'fooldal') munkamenetenként egyszer játszik le – visszalépéskor már nem. */
export function Beuszo({ sorszam, kulcs, children, style }: { sorszam: number; kulcs: string; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const ki = useMozgasKi();
  const elso = useRef(!latottBeuszas.has(kulcs)).current;
  const indul = elso && !ki;
  const o = useRef(new Animated.Value(indul ? 0 : 1)).current;
  const y = useRef(new Animated.Value(indul ? 12 : 0)).current;
  useEffect(() => {
    if (!indul) return;
    const t = setTimeout(() => latottBeuszas.add(kulcs), 0);
    Animated.parallel([
      Animated.timing(o, { toValue: 1, duration: MOZGAS_IDO.beuszas, delay: beuszasKesleltetes(sorszam), easing: gorbe, useNativeDriver: NATIV_MEGHAJTO }),
      Animated.timing(y, { toValue: 0, duration: MOZGAS_IDO.beuszas, delay: beuszasKesleltetes(sorszam), easing: gorbe, useNativeDriver: NATIV_MEGHAJTO }),
    ]).start();
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <Animated.View style={[style, { opacity: o, transform: [{ translateY: y }] }]}>{children}</Animated.View>;
}

// ---------- 2. felpörgő összeg ----------
/** A fő összeg 0-ról a végértékig pörög (400 ms). Táblázatos számjegyekkel (nincs elrendezés-ugrás); a felolvasó mindig a
 *  végértéket kapja. `format`: a szám kiírása (pl. ezres tagolás). */
export function PorgoOsszeg({ ertek, format, children, ...t }: TProps & { ertek: number; format: (n: number) => string }) {
  const ki = useMozgasKi();
  const [n, setN] = useState(ki ? ertek : 0);
  const elozo = useRef<number | null>(null);
  useEffect(() => {
    if (ki || elozo.current === ertek) {
      elozo.current = ertek;
      setN(ertek);
      return;
    }
    const tol = elozo.current ?? 0;
    elozo.current = ertek;
    const kezd = Date.now();
    let kocka = 0;
    const lep = () => {
      const x = (Date.now() - kezd) / MOZGAS_IDO.porges;
      setN(tol + porgoErtek(ertek - tol, x));
      if (x < 1) kocka = requestAnimationFrame(lep);
    };
    kocka = requestAnimationFrame(lep);
    return () => cancelAnimationFrame(kocka);
  }, [ertek, ki]);
  return (
    <T {...t} szam accessibilityLabel={t.accessibilityLabel ?? format(ertek)}>
      {format(n)}
      {children}
    </T>
  );
}

// ---------- 3. töltődő csík ----------
/** Haladás- és keretcsík: a kitöltés scaleX 0 → arány (400 ms, bal szélről). */
export function ToltoCsik({ arany, magas = 9, szinTele = szin.sarga, szinAlap = szin.csikAlap, sugar, style, label }: { arany: number; magas?: number; szinTele?: string; szinAlap?: string; sugar?: number; style?: StyleProp<ViewStyle>; label?: string }) {
  const ki = useMozgasKi();
  const a = Math.max(0, Math.min(1, arany));
  const s = useRef(new Animated.Value(ki ? a : 0)).current;
  const [w, setW] = useState(0);
  useEffect(() => {
    if (ki) {
      s.setValue(a);
      return;
    }
    Animated.timing(s, { toValue: a, duration: MOZGAS_IDO.csik, easing: gorbe, useNativeDriver: NATIV_MEGHAJTO }).start();
  }, [a, ki, s]);
  const r = sugar ?? magas / 2;
  // scaleX a középpontból nyújt: a bal szélhez rögzítéshez a csíkot a fél szélesség hiányával toljuk (transformOrigin nélkül,
  // ami a régi Androidon nem megbízható).
  const tx = s.interpolate({ inputRange: [0, 1], outputRange: [-w / 2, 0] });
  return (
    <View style={[{ height: magas, borderRadius: r, backgroundColor: szinAlap, overflow: 'hidden' }, style]} onLayout={(e) => setW(e.nativeEvent.layout.width)} accessibilityRole={label ? 'image' : undefined} accessibilityLabel={label}>
      <Animated.View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: w, borderRadius: r, backgroundColor: szinTele, transform: [{ translateX: tx }, { scaleX: s }] }} />
    </View>
  );
}

// ---------- 5. felpattanó zöld pipa ----------
/** „Megjelölöm, hogy félretettem” / „Befizettem” után: zöld pipa 0,6 → 1,08 → 1 + opacity, 350 ms; natívan siker-rezgés. */
export function FelpattanoPipa({ pt = 28, lathato = true, label = 'kész', rezges = true }: { pt?: number; lathato?: boolean; label?: string; rezges?: boolean }) {
  const ki = useMozgasKi();
  const s = useRef(new Animated.Value(ki || !lathato ? 1 : 0.6)).current;
  const o = useRef(new Animated.Value(ki ? 1 : 0)).current;
  useEffect(() => {
    if (!lathato) return;
    if (rezges && Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
    if (ki) {
      s.setValue(1);
      o.setValue(1);
      return;
    }
    s.setValue(0.6);
    o.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(s, { toValue: 1.08, duration: MOZGAS_IDO.pipa * 0.6, easing: gorbe, useNativeDriver: NATIV_MEGHAJTO }),
        Animated.timing(s, { toValue: 1, duration: MOZGAS_IDO.pipa * 0.4, useNativeDriver: NATIV_MEGHAJTO }),
      ]),
      Animated.timing(o, { toValue: 1, duration: MOZGAS_IDO.pipa * 0.5, useNativeDriver: NATIV_MEGHAJTO }),
    ]).start();
  }, [lathato]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!lathato) return null;
  return (
    <Animated.View style={{ width: pt, height: pt, borderRadius: pt / 2, backgroundColor: szin.zold, alignItems: 'center', justifyContent: 'center', opacity: o, transform: [{ scale: s }] }} accessible accessibilityLabel={label} accessibilityRole="image">
      <PipaJel pt={pt * 0.62} />
    </Animated.View>
  );
}

/** Fehér pipa (két vonal) – a zöld körbe. */
function PipaJel({ pt }: { pt: number }) {
  const v = Math.max(2, pt * 0.16);
  return (
    <View style={{ width: pt, height: pt, transform: [{ rotate: '-45deg' }], alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: pt * 0.75, height: pt * 0.42, borderLeftWidth: v, borderBottomWidth: v, borderColor: '#fff', marginTop: -pt * 0.12 }} />
    </View>
  );
}

// ---------- 6. konfetti (egyszeri, ≤ 1,2 s) ----------
const KONFETTI_SZINEK = ['#FFC93C', '#1428DB', '#157A3E', '#EF3B3B', '#1F3BE0', '#E9AE12'];
/** Rövid, egyszeri konfetti (16 darab), a szülő tetejéről. Csökkentett mozgásnál semmi (a hívó statikus pipát mutat). */
export function Konfetti({ kulcs, darab = 16 }: { kulcs: string; darab?: number }) {
  const ki = useMozgasKi();
  const [lathato, setLathato] = useState(() => !ki && !latottKonfetti.has(kulcs));
  const darabok = useMemo(
    () =>
      Array.from({ length: darab }, (_, i) => ({
        x: ((i * 61) % 100) / 100,
        dx: (((i * 37) % 21) - 10) * 4,
        h: 140 + ((i * 53) % 90),
        r: ((i * 97) % 360) - 180,
        szin: KONFETTI_SZINEK[i % KONFETTI_SZINEK.length],
        kesik: (i % 5) * 40,
      })),
    [darab],
  );
  const t = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!lathato) return;
    latottKonfetti.add(kulcs);
    Animated.timing(t, { toValue: 1, duration: MOZGAS_IDO.konfetti, easing: gorbe, useNativeDriver: NATIV_MEGHAJTO }).start(() => setLathato(false));
  }, [lathato]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!lathato) return null;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 260, overflow: 'hidden' }} aria-hidden>
      {darabok.map((d, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left: `${8 + d.x * 84}%`,
            top: -12,
            width: 8,
            height: 12,
            borderRadius: 2,
            backgroundColor: d.szin,
            opacity: t.interpolate({ inputRange: [0, 0.75, 1], outputRange: [1, 1, 0] }),
            transform: [
              { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, d.h] }) },
              { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, d.dx] }) },
              { rotate: t.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${d.r}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}
const latottKonfetti = new Set<string>();

// ---------- 7. villanás + repülő bélyegkép (fotózás) ----------
/** Exponáláskor fehér villanás: opacity 0 → 0,85 → 0 (200 ms). A `jel` változása indítja. */
export function Villanas({ jel }: { jel: number }) {
  const ki = useMozgasKi();
  const o = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!jel || ki) return;
    o.setValue(0);
    Animated.sequence([
      Animated.timing(o, { toValue: 0.85, duration: MOZGAS_IDO.villanas * 0.35, useNativeDriver: NATIV_MEGHAJTO }),
      Animated.timing(o, { toValue: 0, duration: MOZGAS_IDO.villanas * 0.65, useNativeDriver: NATIV_MEGHAJTO }),
    ]).start();
  }, [jel]); // eslint-disable-line react-hooks/exhaustive-deps
  return <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: '#fff', opacity: o }} />;
}

/** A lefotózott kép bélyegképe a Dosszié fül felé „repül” (scale 1 → 0,15 + eltolás + opacity, 400 ms). */
export function RepuloKep({ jel, children, cel = { x: -110, y: 360 } }: { jel: number; children: ReactNode; cel?: { x: number; y: number } }) {
  const ki = useMozgasKi();
  const t = useRef(new Animated.Value(1)).current;
  const [lathato, setLathato] = useState(false);
  useEffect(() => {
    if (!jel || ki) return;
    setLathato(true);
    t.setValue(0);
    Animated.timing(t, { toValue: 1, duration: MOZGAS_IDO.repules, delay: MOZGAS_IDO.villanas, easing: gorbe, useNativeDriver: NATIV_MEGHAJTO }).start(() => setLathato(false));
  }, [jel]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!lathato) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={{
        position: 'absolute',
        alignSelf: 'center',
        top: '30%',
        opacity: t.interpolate({ inputRange: [0, 0.8, 1], outputRange: [1, 0.9, 0] }),
        transform: [
          { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, cel.x] }) },
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, cel.y] }) },
          { scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 0.15] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

// ---------- 8. áttűnés (a helykitöltő után) ----------
/** A betöltött tartalom 200 ms-os áttűnéssel érkezik (csökkentett mozgásnál azonnal). */
export function Attuno({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const ki = useMozgasKi();
  const o = useRef(new Animated.Value(ki ? 1 : 0)).current;
  useEffect(() => {
    if (ki) return;
    Animated.timing(o, { toValue: 1, duration: MOZGAS_IDO.attunes, useNativeDriver: NATIV_MEGHAJTO }).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <Animated.View style={[style, { opacity: o }]}>{children}</Animated.View>;
}

// ---------- 9. alsó sáv: fül-ugrás és pötty-pattanás ----------
/** A kiválasztott fül ikonja picit megugrik (translateY 0→-3→0, scale 1→1,08→1, 250 ms), amikor aktív lesz. */
export function UgroIkon({ aktiv, children }: { aktiv: boolean; children: ReactNode }) {
  const ki = useMozgasKi();
  const t = useRef(new Animated.Value(0)).current;
  const elozo = useRef(aktiv);
  useEffect(() => {
    if (aktiv && !elozo.current && !ki) {
      t.setValue(0);
      Animated.timing(t, { toValue: 1, duration: MOZGAS_IDO.fulUgras, easing: gorbe, useNativeDriver: NATIV_MEGHAJTO }).start();
    }
    elozo.current = aktiv;
  }, [aktiv, ki, t]);
  return (
    <Animated.View
      style={{
        transform: [
          { translateY: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, -3, 0] }) },
          { scale: t.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.08, 1] }) },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
}

/** Az olvasatlan-pötty felpattan (scale 0 → 1,2 → 1, 300 ms), amikor megjelenik. */
export function PattanoPont({ lathato, style }: { lathato: boolean; style?: StyleProp<ViewStyle> }) {
  const ki = useMozgasKi();
  const s = useRef(new Animated.Value(lathato ? 1 : 0)).current;
  const elozo = useRef(lathato);
  useEffect(() => {
    if (lathato && !elozo.current) {
      if (ki) s.setValue(1);
      else {
        s.setValue(0);
        Animated.sequence([
          Animated.timing(s, { toValue: 1.2, duration: MOZGAS_IDO.pontPattan * 0.6, easing: gorbe, useNativeDriver: NATIV_MEGHAJTO }),
          Animated.timing(s, { toValue: 1, duration: MOZGAS_IDO.pontPattan * 0.4, useNativeDriver: NATIV_MEGHAJTO }),
        ]).start();
      }
    }
    elozo.current = lathato;
  }, [lathato, ki, s]);
  if (!lathato) return null;
  return <Animated.View style={[{ width: 13, height: 13, borderRadius: 7, backgroundColor: szin.pont, borderWidth: 2, borderColor: '#fff' }, style, { transform: [{ scale: s }] }]} />;
}

// ---------- 13. gép: a feltöltött elem a listába érkezik ----------
/** Új listaelem: translateY -8 → 0 + opacity (300 ms). */
export function ErkezoElem({ children, uj }: { children: ReactNode; uj: boolean }) {
  const ki = useMozgasKi();
  const t = useRef(new Animated.Value(uj && !ki ? 0 : 1)).current;
  useEffect(() => {
    if (!uj || ki) return;
    Animated.timing(t, { toValue: 1, duration: MOZGAS_IDO.listaRepules, easing: gorbe, useNativeDriver: NATIV_MEGHAJTO }).start();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <Animated.View style={{ opacity: t, transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }] }}>{children}</Animated.View>;
}

