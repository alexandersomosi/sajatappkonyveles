// Közös elemek a C2 dizájn szerint (tokens.css): fejlécsáv rozettával, lap, gombok, címke, szakaszcím, állapotszó.
// Alak = feladat: kapszula csak gomb; 18 pt-os lap tartalom; 12 pt mező és csempe; 6 pt állapotcímke.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { forma, szin } from '../theme/tokens';
import { Ikon3d, KeszJel, type Ikon3dNev } from './kepek';
import { T } from './T';
import { SAV, useTeljes } from './teljes';

const ROZETTA = require('../../assets/textura/rozetta.png');

/** A tintakék fejlécsáv; a rozetta közepe (rozX, rozY) a sáv bal felső sarkától. */
export function Fejlec({ children, rozX = 150, rozY = 100, alsoTer = 22, style, felsoTer = true }: { children: ReactNode; rozX?: number; rozY?: number; alsoTer?: number; style?: StyleProp<ViewStyle>; felsoTer?: boolean }) {
  const ins = useSafeAreaInsets();
  const felul = felsoTer ? (Platform.OS === 'web' ? 18 : ins.top + 4) : 0;
  return (
    <View style={[{ backgroundColor: szin.tintakek, paddingTop: felul, paddingBottom: alsoTer, overflow: 'hidden' }, style]}>
      <Image
        source={ROZETTA}
        style={{ position: 'absolute', width: 440, height: 440, left: rozX - 220, top: rozY - 220 + felul - 47 }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
      />
      {children}
    </View>
  );
}

/**
 * Tartalom-lap. A képernyőn (SPEC §28.K.10, C + elválasztó) teljes szélességű fehér szakasz, fölötte a 8 pt-os halvány
 * sáv; lekerekítés, árnyék nincs. `kotott` = közvetlenül a szakaszcím alatt (nincs sáv), `elso` = rögtön a kék sáv alatt.
 * Alsó lapon (sheet) belül marad a régi lekerekített kártya.
 */
export function Lap({ children, style, belso = false, kotott, elso }: { children: ReactNode; style?: StyleProp<ViewStyle>; belso?: boolean; kotott?: boolean; elso?: boolean }) {
  const teljes = useTeljes();
  if (!teljes) return <View style={[{ backgroundColor: szin.lap, borderRadius: forma.lap, overflow: 'hidden' }, belso && { padding: 18 }, style]}>{children}</View>;
  // a hívó margói és lekerekítése a szakaszos elrendezésben nem érvényesek: a szakaszokat csak a sáv választja el
  const { margin, marginTop, marginBottom, marginVertical, marginHorizontal, marginLeft, marginRight, borderRadius, ...tobbi } = (StyleSheet.flatten(style) ?? {}) as ViewStyle;
  void [margin, marginTop, marginBottom, marginVertical, marginHorizontal, marginLeft, marginRight, borderRadius];
  return (
    <View style={[{ backgroundColor: szin.lap, marginHorizontal: -forma.margo, borderTopWidth: kotott || elso ? 0 : SAV.vastag, borderTopColor: SAV.szin, overflow: 'hidden' }, belso && { padding: 16 }, tobbi]}>
      {children}
    </View>
  );
}

/** Szakaszfej (C): 3D ikon 28 + sötét cím 18/650 + legfeljebb egy kapszula jobbra; alatta egy mondat 15-ös másodlagos. */
export function Szakasz({ cim, megj, style, ikon, jobbra, elso }: { cim: string; megj?: string; style?: StyleProp<ViewStyle>; ikon?: Ikon3dNev; jobbra?: ReactNode; elso?: boolean }) {
  const teljes = useTeljes();
  if (!teljes) {
    return (
      <View style={[{ paddingTop: 24, paddingBottom: megj ? 8 : 10, paddingHorizontal: 4 }, style]}>
        <T m={18} s={650} lh={1.3} ls={-0.012} accessibilityRole="header">
          {cim}
        </T>
        {megj ? (
          <T m={15} lh={1.4} c={szin.halvany} style={{ marginTop: 4 }}>
            {megj}
          </T>
        ) : null}
      </View>
    );
  }
  return (
    <View style={[{ marginHorizontal: -forma.margo, backgroundColor: szin.lap, borderTopWidth: elso ? 0 : SAV.vastag, borderTopColor: SAV.szin, paddingTop: 16, paddingHorizontal: 16, paddingBottom: megj ? 8 : 4 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 32 }}>
        {ikon ? <Ikon3d nev={ikon} pt={28} /> : null}
        <T m={18} s={650} lh={1.3} ls={-0.012} accessibilityRole="header" style={{ flex: 1, minWidth: 0 }}>
          {cim}
        </T>
        {jobbra}
      </View>
      {megj ? (
        <T m={15} lh={1.4} c={szin.halvany} style={{ marginTop: 4, paddingLeft: ikon ? 38 : 0 }}>
          {megj}
        </T>
      ) : null}
    </View>
  );
}

type GombProps = Omit<PressableProps, 'children' | 'style'> & { cim: string; ikon?: Ikon3dNev; tolt?: boolean; style?: StyleProp<ViewStyle>; magas?: number };

/** Elsődleges gomb: tele tintakék kapszula, árnyék nélkül, képernyőnként egy. Ikon nincs rajta (a sötét tárgy beleolvadna). */
export function GombE({ cim, tolt, style, magas = 52, disabled, ...p }: GombProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || tolt}
      {...p}
      style={({ pressed }) => [
        { minHeight: magas, borderRadius: forma.gomb, backgroundColor: szin.tintakek, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 4, flexDirection: 'row', gap: 9 },
        (disabled || tolt) && { opacity: 0.55 },
        pressed && { opacity: 0.88 },
        style,
      ]}
    >
      {tolt ? <ActivityIndicator color="#fff" /> : null}
      {/* SPEC §28.K.10: nagy betűméretnél a fő gomb két sorra nőhet, a felirat soha nem csonkolódik */}
      <T m={magas < 52 ? 16.5 : 17} s={650} c="#fff" ls={-0.005} numberOfLines={2} kozep style={{ flexShrink: 1 }}>
        {cim}
      </T>
    </Pressable>
  );
}

/** Másodlagos gomb: világoskék kapszula (ez a világoskék csak az övé), 3D ikonnal vagy anélkül. */
export function GombM({ cim, ikon, tolt, style, magas = 40, disabled, ...p }: GombProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled || tolt}
      hitSlop={magas < 44 ? { top: (44 - magas) / 2, bottom: (44 - magas) / 2 } : undefined}
      {...p}
      style={({ pressed }) => [
        {
          height: magas,
          borderRadius: forma.gomb,
          backgroundColor: pressed ? szin.gombMNyomott : szin.gombMAlap,
          alignItems: 'center',
          justifyContent: 'center',
          paddingLeft: ikon ? 15 : 18,
          paddingRight: 18,
          flexDirection: 'row',
          gap: 8,
          alignSelf: 'flex-start',
          maxWidth: '100%',
        },
        (disabled || tolt) && { opacity: 0.55 },
        style,
      ]}
    >
      {tolt ? <ActivityIndicator color={szin.tintakekSzoveg} /> : ikon ? <Ikon3d nev={ikon} pt={magas < 44 ? 24 : 26} style={{ marginLeft: -3 }} /> : null}
      <T m={magas >= 52 ? 17 : 15.5} s={650} c={szin.tintakekSzoveg} ls={-0.005} numberOfLines={1} style={{ flexShrink: 1 }}>
        {cim}
      </T>
    </Pressable>
  );
}

/** Szöveges gomb: közepes súly, 1 pt-os aláhúzás. */
export function GombSz({ cim, veszely, m = 15.5, style, c, ...p }: Omit<PressableProps, 'children' | 'style'> & { cim: string; veszely?: boolean; m?: number; style?: StyleProp<ViewStyle>; c?: string }) {
  return (
    <Pressable accessibilityRole="button" hitSlop={8} {...p} style={({ pressed }) => [{ paddingVertical: 10, alignSelf: 'flex-start' }, pressed && { opacity: 0.6 }, style]}>
      <T m={m} s={500} lh={1.2} c={c ?? (veszely ? szin.veszely : szin.tintakekSzoveg)} alahuz>
        {cim}
      </T>
    </Pressable>
  );
}

/** A sáv egyetlen gombja: fehér körvonal, fehér szöveg, 3D ikonnal (pl. számológép). */
export function GombSav({ cim, ikon, style, ...p }: Omit<PressableProps, 'children' | 'style'> & { cim: string; ikon?: Ikon3dNev; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable
      accessibilityRole="button"
      {...p}
      style={({ pressed }) => [
        { flexDirection: 'row', alignItems: 'center', gap: 7, height: 40, paddingLeft: 10, paddingRight: 15, borderRadius: forma.gomb, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.78)', alignSelf: 'flex-start' },
        pressed && { backgroundColor: 'rgba(255,255,255,0.08)' },
        style,
      ]}
    >
      {ikon ? <Ikon3d nev={ikon} pt={24} /> : null}
      <T m={15.5} s={600} c="#fff">
        {cim}
      </T>
    </Pressable>
  );
}

/** Állapotcímke (6 pt-os sarok): borostyán „még 3 nap”. */
export function Cimke({ szoveg, veszely, style }: { szoveg: string; veszely?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ height: 24, paddingHorizontal: 8, borderRadius: forma.cimke, backgroundColor: veszely ? szin.veszelyAlap : szin.borostyanAlap, justifyContent: 'center', alignSelf: 'center' }, style]}>
      <T m={13.5} s={650} lh={1.2} c={veszely ? szin.veszelySzoveg : szin.borostyanSzoveg} numberOfLines={1}>
        {szoveg}
      </T>
    </View>
  );
}

/** Állapot: sima szöveg, a szó félkövér tinta; kész esetén előtte az ibolya pecsét. */
export function Allapot({ szo, utana, kesz, veszely, m = 14.5, style }: { szo: string; utana?: string; kesz?: boolean; veszely?: boolean; m?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }, style]}>
      {kesz ? <KeszJel pt={m + 4.5} /> : null}
      <T m={m} lh={1.35} c={szin.halvany} style={{ flexShrink: 1 }}>
        <T m={m} s={650} lh={1.35} c={veszely ? szin.veszely : undefined}>
          {szo}
        </T>
        {utana ? `, ${utana}` : ''}
      </T>
    </View>
  );
}

/** Felsorolás számozott, semleges korongokkal. Az ibolya pecsét (KeszJel) csak a ténylegesen kész dolgoké (TERV A7). */
export function Felsorolas({ elemek, style }: { elemek: string[]; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      {elemek.map((s, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
          <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: szin.alap, alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
            <T m={12.5} s={750} lh={1}>
              {i + 1}
            </T>
          </View>
          <T m={15.5} lh={1.45} style={{ flex: 1 }}>
            {s}
          </T>
        </View>
      ))}
    </View>
  );
}

/** Vékony elválasztó a lapon belül. */
export const Hajszal = ({ bal = 0, jobb = 0 }: { bal?: number; jobb?: number }) => (
  <View style={{ height: 1, backgroundColor: szin.hajszal, marginLeft: bal, marginRight: jobb }} />
);

/** Lista-sor: 3D tárgy 44 pt-on (kör nélkül), a kész-jel a jobb felső sarkán; az egész sor koppintható. */
export function Sor({ ikon, kesz, cim, al, onPress, elso, minH = 52, cimSzin, cimSuly = 600, jobbra, label, zaroltOk }: {
  ikon?: Ikon3dNev; kesz?: boolean; cim: string; al?: ReactNode; onPress?: () => void; elso?: boolean; minH?: number; cimSzin?: string; cimSuly?: 500 | 600 | 650; jobbra?: ReactNode; label?: string;
  /** SPEC §26.5.3: a locked row stays focusable and opens the reason, but says "disabled" + the reason to screen readers. */
  zaroltOk?: string;
}) {
  const ref = useRef<unknown>(null);
  // react-native-web 0.21 writes aria-disabled only from Pressable's own `disabled` (which would also block the press,
  // and a <button disabled> cannot be focused), and it drops accessibilityState/hint: so on the web the attribute is set
  // on the DOM node directly (a <button aria-disabled="true"> stays focusable and clickable), the reason is in the label.
  useEffect(() => {
    if (Platform.OS !== 'web' || !zaroltOk) return;
    (ref.current as unknown as { setAttribute?: (k: string, v: string) => void } | null)?.setAttribute?.('aria-disabled', 'true');
  });
  return (
    <Pressable
      ref={ref as never}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={zaroltOk && Platform.OS === 'web' ? `${label ?? cim}. ${zaroltOk}` : label}
      {...(zaroltOk ? { accessibilityState: { disabled: true }, accessibilityHint: zaroltOk } : {})}
      style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, paddingLeft: 16, paddingRight: 16, minHeight: minH }, pressed && { backgroundColor: '#F6F8FB' }]}
    >
      {!elso && <View style={{ position: 'absolute', top: 0, left: ikon ? 54 : 16, right: 16, height: 1, backgroundColor: szin.hajszal }} />}
      {ikon ? (
        <View style={{ width: 28, height: 28 }}>
          <Ikon3d nev={ikon} pt={28} />
          {kesz ? (
            <View style={{ position: 'absolute', right: -6, top: -5, width: 17, height: 17, borderRadius: 9, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
              <KeszJel pt={15} />
            </View>
          ) : null}
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T m={16} s={cimSuly} lh={1.35} c={cimSzin ?? szin.tinta}>
          {cim}
        </T>
        {typeof al === 'string' ? (
          <T m={15} lh={1.4} c={szin.halvany} style={{ marginTop: 1 }}>
            {al}
          </T>
        ) : (
          al
        )}
      </View>
      {jobbra}
    </Pressable>
  );
}

/** Összeg: tabulált számok, a „Ft” kisebb és halványabb. */
export function Osszeg({ szoveg, m = 17, s = 700, c = szin.tinta, ftSzin = szin.halvany }: { szoveg: string; m?: number; s?: 600 | 700 | 800; c?: string; ftSzin?: string }) {
  return (
    <T m={m} s={s} lh={1.2} c={c} szam ls={-0.01} numberOfLines={1}>
      {szoveg}
      <T m={m * 0.78} s={500} c={ftSzin}>
        {' Ft'}
      </T>
    </T>
  );
}

/** Vissza-link szövegként (nyíl-ikon nincs): „Vissza az októberi dossziéhoz”. */
export function Vissza({ cim, onPress, sotet }: { cim: string; onPress: () => void; sotet?: boolean }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={6} style={({ pressed }) => [{ height: 44, justifyContent: 'center', alignSelf: 'flex-start', paddingHorizontal: sotet ? 20 : 20 }, pressed && { opacity: 0.6 }]}>
      <T m={sotet ? 16 : 16.5} s={500} c={sotet ? '#fff' : szin.tintakekSzoveg} alahuz>
        {cim}
      </T>
    </Pressable>
  );
}

/** Szegmens a sávon (hónapváltó), 10 pt-os sarok. */
export function Szegmens({ elemek, aktiv, valt }: { elemek: { kulcs: string; cim: string }[]; aktiv: string; valt: (k: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', height: 40, padding: 3, marginHorizontal: 16, marginTop: 8, borderRadius: 11, backgroundColor: 'rgba(255,255,255,0.1)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' }} accessibilityRole="tablist">
      {elemek.map((e) => {
        const on = e.kulcs === aktiv;
        return (
          <Pressable key={e.kulcs} onPress={() => valt(e.kulcs)} accessibilityRole="tab" accessibilityState={{ selected: on }} aria-selected={on} style={{ flex: 1, borderRadius: 8, backgroundColor: on ? '#fff' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
            <T m={15} s={on ? 700 : 600} c={on ? szin.tintakek : szin.szegmensFelirat} numberOfLines={1}>
              {e.cim}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Hibasáv a lapon (piros szöveg, nem ikon). */
export function HibaSzoveg({ szoveg, style }: { szoveg?: string | null; style?: StyleProp<ViewStyle> }) {
  if (!szoveg) return null;
  return (
    <View style={[{ marginTop: 8 }, style]} accessibilityLiveRegion="polite">
      <T m={14.5} s={500} c={szin.veszely} lh={1.4}>
        {szoveg}
      </T>
    </View>
  );
}

/** Jelölőnégyzet szöveggel (nyilatkozatok): a pipa Geist-szöveg (✓), nem ikon. */
export function Pipa({ be, valt, children, style }: { be: boolean; valt: (b: boolean) => void; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: be }} aria-checked={be} onPress={() => valt(!be)} style={[{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 8 }, style]}>
      <View style={{ width: 24, height: 24, borderRadius: 6, borderWidth: be ? 0 : 1.5, borderColor: szin.mezoKeret, backgroundColor: be ? szin.tintakek : '#fff', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
        {be ? (
          <T m={15} s={700} c="#fff" lh={1}>
            ✓
          </T>
        ) : null}
      </View>
      <View style={{ flex: 1 }}>{typeof children === 'string' ? <T m={15.5} lh={1.45}>{children}</T> : children}</View>
    </Pressable>
  );
}

/** Választó (rádió) kártyák: szöveges, keretes 12 pt-os elemek. */
export function Valaszto<K extends string>({ elemek, ertek, valt }: { elemek: { kulcs: K; cim: string; al?: string }[]; ertek: K | null; valt: (k: K) => void }) {
  return (
    <View style={{ gap: 8 }} accessibilityRole="radiogroup">
      {elemek.map((e) => {
        const on = e.kulcs === ertek;
        return (
          <Pressable
            key={e.kulcs}
            accessibilityRole="radio"
            accessibilityState={{ selected: on, checked: on }}
            aria-checked={on}
            aria-label={e.al ? `${e.cim}. ${e.al}` : e.cim}
            onPress={() => valt(e.kulcs)}
            style={{ borderRadius: forma.mezo, borderWidth: on ? 2 : 1, borderColor: on ? szin.tintakek : szin.keret, backgroundColor: on ? '#fff' : szin.mezoAlap, paddingVertical: on ? 11 : 12, paddingHorizontal: on ? 13 : 14, flexDirection: 'row', gap: 12 }}
          >
            <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: on ? 7 : 1.5, borderColor: on ? szin.tintakek : szin.mezoKeret, backgroundColor: '#fff', marginTop: 1 }} />
            <View style={{ flex: 1 }}>
              <T m={16} s={600} lh={1.35}>
                {e.cim}
              </T>
              {e.al ? (
                <T m={14} c={szin.halvany} lh={1.4} style={{ marginTop: 2 }}>
                  {e.al}
                </T>
              ) : null}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Kapcsoló (be/ki) szöveges jelöléssel – nincs ikon. */
export function Kapcsolo({ be, valt, cim, al, tilt, tema }: { be: boolean; valt: (b: boolean) => void; cim: string; al?: string; tilt?: boolean; /** Képernyőolvasónak: melyik témáé a kapcsoló. */ tema?: string }) {
  const [nyomva, setNyomva] = useState(false);
  return (
    <Pressable
      accessibilityRole="switch"
      accessibilityState={{ checked: be, disabled: tilt }}
      aria-checked={be}
      aria-disabled={tilt}
      aria-label={[tema, al ? `${cim}. ${al}` : cim].filter(Boolean).join(': ')}
      disabled={tilt}
      onPress={() => valt(!be)}
      onPressIn={() => setNyomva(true)}
      onPressOut={() => setNyomva(false)}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 18, opacity: tilt ? 0.5 : nyomva ? 0.8 : 1 }}
    >
      <View style={{ flex: 1 }}>
        <T m={16} s={500} lh={1.35}>
          {cim}
        </T>
        {al ? (
          <T m={14} c={szin.halvany} lh={1.4} style={{ marginTop: 2 }}>
            {al}
          </T>
        ) : null}
      </View>
      <View style={{ width: 50, height: 30, borderRadius: 15, backgroundColor: be ? szin.tintakek : szin.keret, padding: 3, alignItems: be ? 'flex-end' : 'flex-start' }}>
        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: '#fff' }} />
      </View>
    </Pressable>
  );
}
