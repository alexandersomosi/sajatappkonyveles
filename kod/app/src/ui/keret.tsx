// Képernyő-keret – v2 (k8): szürke háttér, kártyák, a színes alsó sáv (fehér, felül 22-es kerekítés; MINDEN ikon színes,
// az aktív fület 3 pt-es kék felső csík és kék 750-es felirat jelzi), a fix fő gomb (dokk), alsó lap (sheet), lépéssor,
// helykitöltő (skeleton) a forgó kör helyett, hiba, MINTA/DEMO jelzés, rövid visszajelzés (toast).
// Gépen (≥ 1024 pt, web) nincs alsó sáv: a bal menüt a gyökér-elrendezés rajzolja (ui/asztali/Oldalsav), a tartalom egy
// középre tett oszlop (max. 760, ill. `szeles` esetén 1120 pt), a fejléc hős sáv, a dokk a tartalom végén áll.
// A régi C-változat: _regi/elotte_k8_A/src/ui/keret.tsx.
import { Children, cloneElement, createContext, Fragment, isValidElement, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactElement, type ReactNode, type Ref } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, Keyboard, Modal, PixelRatio, Platform, Pressable, ScrollView, StyleSheet, useWindowDimensions, View, type ScrollViewInstance, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { Ikon, NAV_IKONOK } from '../_shared/v2/rn';
import { KERET_SZELESSEG, keretStilus } from '../lib/webkeret';
import { MOZGAS_IDO, mozgasKi } from '../lib/mozgas';
import { useAsztali, useAsztaliMeretek } from '../lib/elrendezes';
import { aktivFulUtbol, MINTA_NELKULI_MAX, TARTALOM_MAX } from '../lib/elrendezesLogika';
import { arnyek, forma, szin } from '../theme/tokens';
import { Fejlec, GombM, KartyaFej, Lap, Sor, Szakasz } from './alap';
import { TeljesCtx } from './teljes';
import { ZarolasSav } from './Zarolas';
import { KeszJel } from './kepek';
import { T } from './T';
import { useVezetettParam, VezetettFelsoSor, VezetettHaladas } from './Vezetett';
import { vezetettJelol, vezetettVissza } from '../lib/vezetett';
import { DemoPirula, demoBeallit as demoBeallitAlap } from './demoAllapot';
import { fotoCimke, useFotozasNyit, useFulAllapot } from './fulAllapot';
import { FelpattanoPipa, PattanoPont, UgroIkon } from './mozgas';

const WEB = Platform.OS === 'web';

/** A v2 alsó sáv magassága (a biztonsági sáv nélkül): 10 + 28 ikon + 4 + 16 felirat + 6. */
export const FULSOR_MAGASSAG = 64;
/** A fix fő gomb (dokk) magassága: 10 + 52 + 12. */
export const DOKK_MAGASSAG = 74;

// ---------- fülsor ----------
function valasztasRezges() {
  if (!WEB) void Haptics.selectionAsync().catch(() => undefined);
}

/** Natívan a nyitott billentyűzet idejére a fülsor elbújik (SPEC §26.5.1; Android adjustResize). */
function useBillentyuzet(): boolean {
  const [nyitva, setNyitva] = useState(false);
  useEffect(() => {
    if (WEB) return;
    const a = Keyboard.addListener('keyboardDidShow', () => setNyitva(true));
    const b = Keyboard.addListener('keyboardDidHide', () => setNyitva(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  return nyitva;
}

/** Bekötés alatt a Főoldal-fülön a még hátralévő teendők száma (sárga pirula, sötét szám: 11,74:1). */
function Jelveny({ n }: { n: number }) {
  if (!n) return null;
  return (
    <View style={{ position: 'absolute', top: 6, left: '56%', minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: szin.sarga, borderWidth: 2, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
      <T m={11.5} s={800} lh={1} c={szin.sotet} szam>
        {n > 9 ? '9+' : n}
      </T>
    </View>
  );
}

/** A v2 alsó sáv: öt fül (a Fotózás is), minden ikon színes 28 pt; az aktív: kék felső csík + kék 750-es felirat. */
export function Fulsor({ aktiv, dokkFelette }: { aktiv: string; dokkFelette?: boolean }) {
  const ins = useSafeAreaInsets();
  const billentyuzet = useBillentyuzet();
  const allapot = useFulAllapot();
  const fotozas = useFotozasNyit();
  // 360 pt alatt (pl. 320-as kijelző) vagy nagy rendszer-betűméretnél a feliratok összeérnének: kisebb betű, és a
  // fül-feliratok legfeljebb 110%-ig nőnek (a teljes név az akadálymentes címkében marad).
  const { width } = useWindowDimensions();
  const nagyBetu = PixelRatio.getFontScale() > 1.15;
  const szuk = Math.min(width, 480) < 360 || nagyBetu;
  const alul = WEB ? 6 : ins.bottom;
  if (billentyuzet) return null;
  const jelvenyek: Record<string, number> = { fooldal: allapot.fooldal, uzenetek: allapot.uzenetek };
  return (
    <View
      style={[
        { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: szin.lap, paddingBottom: alul, paddingHorizontal: 6 },
        dokkFelette ? null : { borderTopLeftRadius: 22, borderTopRightRadius: 22, ...arnyek.sav },
      ]}
    >
      <View accessibilityRole="tablist" style={{ height: FULSOR_MAGASSAG, flexDirection: 'row' }}>
        {NAV_IKONOK.map((f) => {
          const on = f.kulcs === aktiv;
          const foto = f.kulcs === 'fotozas';
          const db = jelvenyek[f.kulcs] ?? 0;
          return (
            <Pressable
              key={f.kulcs}
              accessibilityRole={foto ? 'button' : 'tab'}
              accessibilityLabel={foto ? fotoCimke(allapot) : db ? (f.kulcs === 'fooldal' ? `${f.felirat}, még ${db} teendő` : `${f.felirat}, ${db} új`) : f.felirat}
              accessibilityState={foto ? undefined : { selected: on }}
              // react-native-web 0.21 nem írja ki az accessibilityState-et: a weben az aria-selected jelzi az aktív fület.
              aria-selected={foto ? undefined : on}
              onPress={() => {
                valasztasRezges();
                if (foto) return void fotozas(allapot.korlatozott);
                if (!on) router.navigate((f.kulcs === 'fooldal' && allapot.korlatozott ? '/bekotes' : f.kulcs === 'fooldal' ? '/' : `/${f.kulcs}`) as never);
              }}
              style={({ pressed }) => [{ flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 10, gap: 4 }, pressed && { opacity: 0.7 }]}
            >
              {on ? <View style={{ position: 'absolute', top: 0, left: '20%', right: '20%', height: 3, borderBottomLeftRadius: 3, borderBottomRightRadius: 3, backgroundColor: szin.tintakek }} /> : null}
              <UgroIkon aktiv={on}>
                <Ikon nev={f.ikon} pt={28} />
              </UgroIkon>
              <T m={szuk ? 11.5 : 13} s={on ? 750 : 600} lh={1.2} c={on ? szin.tintakek : szin.halvany} numberOfLines={1} maxFontSizeMultiplier={1.1}>
                {f.felirat}
              </T>
              {f.kulcs === 'uzenetek' ? <PattanoPont lathato={db > 0} style={{ position: 'absolute', top: 7, left: '54%' }} /> : <Jelveny n={db} />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

/** Az egyetlen fő gomb mindig ugyanott: teljes szélességben, a fülsor fölött (v2 .dokk / .dokk.navfelett). */
function Dokk({ children, ful }: { children: ReactNode; ful: boolean }) {
  const ins = useSafeAreaInsets();
  const billentyuzet = useBillentyuzet();
  const navFelett = ful && !billentyuzet;
  const alul = navFelett ? FULSOR_MAGASSAG + (WEB ? 6 : ins.bottom) : WEB ? 0 : ins.bottom;
  return (
    <View
      style={[
        { position: 'absolute', left: 0, right: 0, bottom: alul, backgroundColor: szin.lap, paddingHorizontal: 16, paddingTop: 10, paddingBottom: navFelett ? 12 : 16 },
        navFelett ? { borderTopWidth: 1, borderTopColor: szin.hajszal } : { borderTopLeftRadius: 22, borderTopRightRadius: 22, ...arnyek.sav },
      ]}
    >
      {children}
    </View>
  );
}

/** Gépen a dokk a tartalom végén áll, egy kártyában (nem fix alsó sáv). */
function DokkAsztali({ children }: { children: ReactNode }) {
  return (
    <Lap style={{ paddingVertical: 18, paddingHorizontal: 22, marginTop: 4 }}>
      <View style={{ maxWidth: 460 }}>{children}</View>
    </Lap>
  );
}

// ---------- szakaszfej + kártya összevonása ----------
/** A tartalom elemei sorban (a Fragmentek és tömbök kibontva). */
function kibont(children: ReactNode): ReactNode[] {
  const ki: ReactNode[] = [];
  Children.forEach(children, (c) => {
    if (isValidElement(c) && c.type === Fragment) ki.push(...kibont((c.props as { children?: ReactNode }).children));
    else if (c !== null && c !== undefined && c !== false && c !== '') ki.push(c);
  });
  return ki;
}

type SzakaszProps = Parameters<typeof Szakasz>[0];
type LapProps = Parameters<typeof Lap>[0];

/** Listakártya-e: az első eleme `Sor` (pl. a Fiók csoportjai) – fölötte a v2 nagybetűs szakaszcím marad. */
function listaE(lap: ReactElement<LapProps>): boolean {
  const elso = kibont(lap.props.children).find((c) => isValidElement(c));
  return isValidElement(elso) && elso.type === Sor;
}

/** Ikonos szakaszfej + az utána jövő kártya EGY v2 kártya: fent csempe + cím (+ egy mondat, jobbra elem), alatta a tartalom. */
function SzakaszKartya({ sz, lap }: { sz: SzakaszProps; lap?: ReactElement<LapProps> }) {
  const st = (StyleSheet.flatten(lap?.props.style) ?? {}) as ViewStyle;
  const vanFent = st.padding != null || st.paddingTop != null || st.paddingVertical != null;
  const vanOldalt = st.padding != null || st.paddingHorizontal != null || st.paddingLeft != null;
  const fej = (
    <KartyaFej
      ikon={sz.ikon}
      cim={sz.cim}
      al={sz.megj}
      jobbra={sz.jobbra}
      style={{ paddingTop: vanFent ? 0 : 16, paddingHorizontal: vanOldalt ? 0 : 14, paddingBottom: lap ? 10 : 16 }}
    />
  );
  if (!lap) return <Lap>{fej}</Lap>;
  return (
    <Lap {...lap.props}>
      {fej}
      {lap.props.children}
    </Lap>
  );
}

/** A régi (C) szakaszos tartalom v2-kártyákká: ikonos Szakasz + Lap → egy kártya; listás Lap fölött nagybetűs cím. */
export function kartyasit(children: ReactNode): ReactNode[] {
  const elemek = kibont(children);
  const ki: ReactNode[] = [];
  for (let i = 0; i < elemek.length; i++) {
    const e = elemek[i];
    if (isValidElement(e) && e.type === Szakasz && (e.props as SzakaszProps).ikon) {
      const sz = e.props as SzakaszProps;
      const kov = elemek[i + 1];
      if (isValidElement(kov) && kov.type === Lap) {
        if (listaE(kov as ReactElement<LapProps>)) {
          ki.push(e);
          continue;
        }
        ki.push(<SzakaszKartya key={(e.key ?? `sk${i}`) as string} sz={sz} lap={kov as ReactElement<LapProps>} />);
        i++;
        continue;
      }
      ki.push(<SzakaszKartya key={(e.key ?? `sk${i}`) as string} sz={sz} />);
      continue;
    }
    ki.push(e);
  }
  // tömbként rajzoljuk ki: minden elemnek legyen kulcsa (a Fragmentből kibontottaknak nincs)
  return ki.map((e, i) => (isValidElement(e) && e.key == null ? cloneElement(e, { key: `k${i}` }) : e));
}

/** k8 mozgás #8: amikor a helykitöltő (Betolt) helyére megjön a tartalom, 200 ms-os áttűnéssel érkezik. */
function useAttunes(toltes: boolean): Animated.Value {
  const o = useRef(new Animated.Value(1)).current;
  const elozo = useRef(toltes);
  useEffect(() => {
    if (elozo.current && !toltes) {
      void mozgasKi().then((ki) => {
        if (ki) return;
        o.setValue(0);
        Animated.timing(o, { toValue: 1, duration: MOZGAS_IDO.attunes, useNativeDriver: !WEB }).start();
      });
    }
    elozo.current = toltes;
  }, [toltes, o]);
  return o;
}

// ---------- képernyő ----------
export function Kepernyo({
  children,
  fejlec,
  ful,
  tartalomStilus,
  frissit,
  frissul,
  gorget = true,
  gorgetoRef,
  dokk,
  szeles,
  ...p
}: {
  children: ReactNode;
  fejlec?: ReactNode;
  /** A képernyő egyetlen fő gombja, fixen a fülsor fölött (telefon) / a tartalom végén (gép). */
  dokk?: ReactNode;
  ful?: string;
  tartalomStilus?: StyleProp<ViewStyle>;
  frissit?: () => void;
  frissul?: boolean;
  gorget?: boolean;
  /** A görgető, ha a képernyő egy laphoz akar görgetni (pl. „Mi kell még?” → a következő lépés). */
  gorgetoRef?: Ref<ScrollViewInstance>;
  /** Gépen a teljes (1120 pt) tartalomszélesség – a kártyarácsos képernyőkhöz (főoldal, fiók, dosszié …). */
  szeles?: boolean;
} & ScrollViewProps) {
  const ins = useSafeAreaInsets();
  const asztali = useAsztali();
  const meret = useAsztaliMeretek();
  // SPEC §29.10.3: a guided step screen (`?vezetett=<lépés>`) is full screen – no tab bar, no lock band – and while it is
  // on top, "Vissza" and the save go along the guided run (lib/vezetett).
  const vezetett = useVezetettParam();
  useEffect(() => (vezetett ? vezetettJelol(vezetett) : undefined), [vezetett]);
  if (vezetett) ful = undefined;
  void frissul;
  const vanFejlec = !!fejlec;
  const toltes = kibont(children).some((c) => isValidElement(c) && c.type === Betolt);
  const attunes = useAttunes(toltes);
  if (asztali) {
    const max = (szeles ? TARTALOM_MAX : MINTA_NELKULI_MAX) + 2 * meret.margo.oldal;
    const tartalom = (
      <View style={{ width: '100%', maxWidth: max, alignSelf: 'center', paddingHorizontal: meret.margo.oldal, paddingTop: meret.margo.fent, paddingBottom: meret.margo.lent }}>
        {fejlec}
        {ful ? <ZarolasSav /> : null}
        <TeljesCtx.Provider value>
          <Animated.View style={[tartalomStilus, { opacity: attunes }]}>{kartyasit(children)}</Animated.View>
          {dokk ? <DokkAsztali>{dokk}</DokkAsztali> : null}
        </TeljesCtx.Provider>
      </View>
    );
    return (
      <View style={{ flex: 1, backgroundColor: szin.alap }}>
        {gorget ? (
          <ScrollView ref={gorgetoRef} keyboardShouldPersistTaps="handled" {...(frissit ? { refreshControl: undefined } : {})} {...p}>
            {tartalom}
          </ScrollView>
        ) : (
          tartalom
        )}
        {vanFejlec ? null : <MintaJel />}
      </View>
    );
  }
  const alsoTer = (ful ? FULSOR_MAGASSAG + 28 + (WEB ? 6 : ins.bottom) : 28 + ins.bottom) + (dokk ? DOKK_MAGASSAG + 8 : 0);
  const tartalom = (
    <>
      {fejlec}
      <TeljesCtx.Provider value>
        <View style={[{ paddingHorizontal: forma.margo, paddingTop: 14, paddingBottom: alsoTer }, tartalomStilus]}>
          {ful ? <ZarolasSav /> : null}
          <Animated.View style={{ opacity: attunes }}>{kartyasit(children)}</Animated.View>
        </View>
      </TeljesCtx.Provider>
    </>
  );
  return (
    <View style={{ flex: 1, backgroundColor: szin.alap }}>
      {gorget ? (
        <ScrollView
          ref={gorgetoRef}
          keyboardShouldPersistTaps="handled"
          contentInsetAdjustmentBehavior="never"
          showsVerticalScrollIndicator={false}
          {...(frissit ? { refreshControl: undefined } : {})}
          {...p}
        >
          {tartalom}
        </ScrollView>
      ) : (
        tartalom
      )}
      {dokk ? <Dokk ful={!!ful}>{dokk}</Dokk> : null}
      {ful ? <Fulsor aktiv={ful} dokkFelette={!!dokk} /> : null}
      {vanFejlec ? null : <MintaJel />}
    </View>
  );
}

/**
 * Aloldal-fejléc (v2 .fej.kis): kék fejléc, balra a kerek vissza-gomb, jobbra a kis logó, alatta a képernyő címe (25/800)
 * és egy mondat. Vezetett futásban a vissza-gomb + „Később folytatom” + a haladás-csík.
 */
export function CimSor({ vissza, visszaCim, cim, al, szakasz }: { vissza?: () => void; visszaCim?: string; cim: string; al?: string; szakasz?: string }) {
  const vissza2 = vissza ?? (() => (vezetettVissza() ? undefined : router.canGoBack() ? router.back() : router.replace('/')));
  const vezetett = useVezetettParam();
  const asztali = useAsztali();
  return (
    <Fejlec kis alsoTer={20} vissza={!vezetett && visszaCim ? { cim: visszaCim, onPress: vissza2 } : null}>
      {vezetett ? (
        <>
          <VezetettFelsoSor vissza={vissza2} kulcs={vezetett} />
          <VezetettHaladas style={{ marginTop: 10, paddingHorizontal: 18 }} />
        </>
      ) : null}
      <View style={{ paddingHorizontal: asztali ? 16 : 18, paddingTop: vezetett ? 12 : 10 }}>
        {szakasz ? (
          <T m={14} s={700} lh={1.3} ls={0.04} c={szin.fejlecHalvany} style={{ textTransform: 'uppercase', marginBottom: 4 }}>
            {szakasz}
          </T>
        ) : null}
        <T m={asztali ? 30 : 25} s={800} lh={1.14} ls={-0.025} c="#fff" accessibilityRole="header">
          {cim}
        </T>
        {al ? (
          <T m={asztali ? 16 : 15} lh={1.45} c={szin.fejlecHalvany} style={{ marginTop: 6 }}>
            {al}
          </T>
        ) : null}
      </View>
    </Fejlec>
  );
}

export function vissza(alap = '/') {
  // SPEC §29.10.3: leaving a guided step screen goes to the previous guided step, not to the checklist
  if (vezetettVissza()) return;
  if (router.canGoBack()) router.back();
  else router.replace(alap as never);
}

// ---------- MINTA / DEMO jelzés ----------
/** A szerver DEMO módját (config.demo / home.demo) itt jelezzük minden képernyőn. */
export const demoBeallit = demoBeallitAlap;
/** Fejléc nélküli képernyőn a DEMO/MINTA pirula a jobb felső sarokban (a fejléces képernyőkön a fejléc rajzolja). */
export function MintaJel() {
  const ins = useSafeAreaInsets();
  return (
    <View pointerEvents="none" style={{ position: 'absolute', top: WEB ? 12 : ins.top + 6, right: 14 }}>
      <DemoPirula kicsi />
    </View>
  );
}

// ---------- alsó lap ----------
export function AlsoLap({
  lathato,
  bezar,
  children,
  bezarGomb = true,
  fuggony = szin.fuggony,
  stilus,
  lab,
}: {
  lathato: boolean;
  bezar: () => void;
  children: ReactNode;
  bezarGomb?: boolean;
  fuggony?: string;
  stilus?: StyleProp<ViewStyle>;
  /** Rögzített lábléc a görgethető tartalom alatt (pl. „Összesen” + „Kérdezek róla”), mindig látszik. */
  lab?: ReactNode;
}) {
  const ins = useSafeAreaInsets();
  const asztali = useAsztali();
  const y = useRef(new Animated.Value(800)).current;
  const o = useRef(new Animated.Value(0)).current;
  const [mutat, setMutat] = useState(lathato);
  // Görgetéskor a lap teteje fehér sáv lesz a „Bezár” alatt, hogy a gomb ne lógjon rá a szövegre/összegekre.
  const [gorgetve, setGorgetve] = useState(false);
  const jelzesAllapot = useContext(JelzesAllapotCtx);
  const lapValt = jelzesAllapot?.lapValt;
  useEffect(() => {
    if (!mutat || !lapValt) return;
    lapValt(1);
    return () => lapValt(-1);
  }, [mutat, lapValt]);
  useEffect(() => {
    let el = true;
    mozgasKi().then((rm) => {
      if (!el) return;
      if (lathato) {
        setMutat(true);
        if (rm) {
          y.setValue(0);
          o.setValue(1);
          return;
        }
        Animated.parallel([
          Animated.spring(y, { toValue: 0, useNativeDriver: !WEB, damping: 26, stiffness: 220, mass: 1, overshootClamping: true }),
          Animated.timing(o, { toValue: 1, duration: 220, useNativeDriver: !WEB }),
        ]).start();
      } else if (mutat) {
        Animated.parallel([
          Animated.timing(y, { toValue: 800, duration: rm ? 0 : 220, easing: Easing.in(Easing.quad), useNativeDriver: !WEB }),
          Animated.timing(o, { toValue: 0, duration: rm ? 0 : 200, useNativeDriver: !WEB }),
        ]).start(() => el && setMutat(false));
      }
    });
    return () => {
      el = false;
    };
  }, [lathato]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!mutat) return null;
  return (
    <Modal transparent visible={mutat} onRequestClose={bezar} animationType="none" statusBarTranslucent>
      <View style={{ flex: 1, alignItems: 'center' }}>
        <Animated.View style={[{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: fuggony, opacity: o }, KERET_SZELESSEG ? { right: undefined, width: KERET_SZELESSEG } : null]}>
          <Pressable style={{ flex: 1 }} onPress={bezar} accessibilityLabel="Bezár" accessibilityRole="button" />
        </Animated.View>
        <View style={[{ flex: 1, justifyContent: asztali ? 'center' : 'flex-end' }, asztali ? { width: '100%', maxWidth: 600, paddingVertical: 32 } : keretStilus]} pointerEvents="box-none">
          <Animated.View
            accessibilityViewIsModal
            aria-modal
            role="dialog"
            style={[
              {
                backgroundColor: szin.lap,
                borderTopLeftRadius: forma.sheet,
                borderTopRightRadius: forma.sheet,
                paddingTop: 20,
                paddingHorizontal: 20,
                paddingBottom: asztali ? 24 : 34 + (WEB ? 0 : ins.bottom),
                maxHeight: asztali ? '100%' : '92%',
                transform: [{ translateY: y }],
                ...arnyek.sheet,
              },
              asztali ? { borderRadius: 22 } : null,
              stilus,
            ]}
          >
            {bezarGomb && gorgetve ? (
              <View
                pointerEvents="none"
                style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 60, backgroundColor: szin.lap, borderTopLeftRadius: forma.sheet, borderTopRightRadius: forma.sheet, borderBottomWidth: 1, borderBottomColor: szin.hajszal, zIndex: 1 }}
              />
            ) : null}
            {bezarGomb ? (
              <Pressable
                onPress={bezar}
                accessibilityRole="button"
                style={({ pressed }) => ({ position: 'absolute', top: 14, right: 14, minHeight: 40, paddingHorizontal: 15, borderRadius: forma.kapszula, backgroundColor: pressed ? szin.keret : szin.nyomott, justifyContent: 'center', zIndex: 2 })}
              >
                <T m={15} s={650}>
                  Bezár
                </T>
              </Pressable>
            ) : null}
            <ScrollView
              showsVerticalScrollIndicator={false}
              bounces={false}
              keyboardShouldPersistTaps="handled"
              scrollEventThrottle={32}
              onScroll={(e) => {
                const g = e.nativeEvent.contentOffset.y > 4;
                if (g !== gorgetve) setGorgetve(g);
              }}
            >
              <TeljesCtx.Provider value={false}>{children}</TeljesCtx.Provider>
            </ScrollView>
            {lab ? <View style={{ borderTopWidth: 1, borderTopColor: szin.hajszal, marginHorizontal: -20, paddingHorizontal: 20, paddingTop: 2, backgroundColor: szin.lap }}>{lab}</View> : null}
          </Animated.View>
        </View>
        <JelzesReteg />
      </View>
    </Modal>
  );
}

// ---------- lépéssor (v2 .lepes) ----------
export interface Lepes {
  cim: string;
  al?: string;
  allapot: 'kesz' | 'most' | 'var';
}
export function Lepessor({ lepesek, meret = 30, erosMost = true }: { lepesek: Lepes[]; meret?: number; erosMost?: boolean }) {
  return (
    <View style={{ paddingTop: 4, paddingHorizontal: 16, paddingBottom: 6 }}>
      {lepesek.map((l, i) => {
        const kesz = l.allapot === 'kesz';
        const most = l.allapot === 'most';
        return (
          <View key={i} style={{ flexDirection: 'row', gap: 12, paddingVertical: 11, borderTopWidth: i ? 1 : 0, borderTopColor: szin.hajszal }} accessibilityLabel={`${i + 1}. ${l.cim}${l.al ? ', ' + l.al : ''}, ${kesz ? 'kész' : most ? 'most tart itt' : 'még hátra van'}`}>
            <View
              style={[
                { width: meret, height: meret, borderRadius: meret / 2, alignItems: 'center', justifyContent: 'center', backgroundColor: kesz ? szin.sarga : most ? szin.tintakek : szin.nyomott },
                most ? { boxShadow: '0 0 0 4px rgba(20,40,219,.14)' } : null,
              ]}
            >
              {kesz ? (
                <T m={15} s={800} lh={1} c={szin.sotet}>
                  ✓
                </T>
              ) : (
                <T m={14} s={750} lh={1} c={most ? '#fff' : szin.halvany} szam>
                  {i + 1}
                </T>
              )}
            </View>
            <View style={{ flex: 1, paddingTop: 4 }}>
              <T m={most && erosMost ? 16 : 15.5} s={700} lh={1.3} c={kesz ? szin.halvany : szin.tinta}>
                {l.cim}
              </T>
              {l.al ? (
                <T m={14} lh={1.4} c={szin.halvany} style={{ marginTop: 2 }}>
                  {l.al}
                </T>
              ) : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

// ---------- betöltés (álló helykitöltők), hiba ----------
function Blokk({ w, h = 12, style }: { w: number | `${number}%`; h?: number; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ width: w, height: h, borderRadius: 6, backgroundColor: szin.helykitolto }, style]} />;
}

/** Betöltés: a forgó kör helyett a kártyák alakját követő, ÁLLÓ szürke blokkok (nincs csillogás – nincs folyamatos
 *  mozgás). A felolvasó a szöveget hallja. `kerek`: a régi forgó kör (pl. a gyökér első pillanatában). */
export function Betolt({ szoveg = 'Betöltjük…', kerek, kartyak = 3 }: { szoveg?: string; kerek?: boolean; kartyak?: number }) {
  if (kerek) {
    return (
      <View style={{ flex: 1, paddingVertical: 48, alignItems: 'center', justifyContent: 'center', gap: 12, backgroundColor: szin.alap }} accessibilityLiveRegion="polite">
        <ActivityIndicator color={szin.tintakek} />
        <T m={15} c={szin.halvany}>
          {szoveg}
        </T>
      </View>
    );
  }
  return (
    <View accessible accessibilityRole="progressbar" accessibilityLabel={szoveg} aria-busy accessibilityLiveRegion="polite">
      {Array.from({ length: kartyak }, (_, i) => (
        <Lap key={i} style={{ padding: 16, flexDirection: 'row', gap: 12 }}>
          <View style={{ width: 42, height: 42, borderRadius: 13, backgroundColor: szin.helykitolto }} />
          <View style={{ flex: 1, gap: 10, paddingTop: 4 }}>
            <Blokk w="46%" h={16} />
            <Blokk w="88%" />
            <Blokk w={i % 2 ? '64%' : '74%'} />
          </View>
        </Lap>
      ))}
    </View>
  );
}

export function Hiba({ hiba, ujra }: { hiba: unknown; ujra?: () => void }) {
  const uzenet = hiba instanceof Error ? hiba.message : 'Valami elromlott.';
  return (
    <Lap belso jelzo={szin.veszely} style={{ marginTop: 4 }}>
      <T m={17} s={700} lh={1.4} accessibilityRole="header">
        Most nem sikerült betölteni.
      </T>
      <T m={15} c={szin.halvany} lh={1.5} style={{ marginTop: 4, marginBottom: ujra ? 12 : 0 }}>
        {uzenet}
      </T>
      {ujra ? <GombM cim="Újra" onPress={ujra} /> : null}
    </Lap>
  );
}

// ---------- rövid visszajelzés ----------
/** Rövid visszajelzés; `gomb` = egy művelet a jelzésen (pl. „Visszavonom”, SPEC §27.2.5) – ilyenkor tovább látszik. */
type Jelzes = { szoveg: string; kesz?: boolean; gomb?: { cim: string; onPress: () => void }; ido?: number };
const JelzesCtx = createContext<(j: Jelzes | string) => void>(() => undefined);
export const useJelzes = () => useContext(JelzesCtx);
/** The current toast, so a Modal (bottom sheet) can draw it on top of itself: a Modal covers everything else. */
const JelzesAllapotCtx = createContext<{ j: Jelzes | null; o: Animated.Value; rejt: () => void; lapValt: (d: number) => void } | null>(null);

function JelzesDoboz({ j, o, rejt, fent }: { j: Jelzes; o: Animated.Value; rejt?: () => void; fent?: boolean }) {
  const ins = useSafeAreaInsets();
  const asztali = useAsztali();
  // Over a bottom sheet the toast sits at the TOP of the screen (on the dim curtain), never on the sheet's cards
  // (11-19 javítás: the "Visszavonom" toast covered the highlighted "Intézzétek helyettem" card).
  const hely = fent ? { top: WEB ? 12 : ins.top + 8 } : { bottom: asztali ? 32 : 150 + ins.bottom };
  return (
    <Animated.View pointerEvents={j.gomb ? 'box-none' : 'none'} style={{ position: 'absolute', left: 16, right: 16, ...hely, alignItems: 'center', opacity: o, zIndex: 1000 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: szin.sotet, borderRadius: 16, paddingVertical: j.gomb ? 6 : 12, paddingLeft: 16, paddingRight: j.gomb ? 6 : 16, maxWidth: 460, ...arnyek.lebego }}>
        {j.kesz ? <FelpattanoPipa key={j.szoveg} pt={22} rezges={false} /> : null}
        <T m={15} s={600} c="#fff" lh={1.35} style={{ flexShrink: 1, paddingVertical: j.gomb ? 6 : 0 }}>
          {j.szoveg}
        </T>
        {j.gomb ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              rejt?.();
              j.gomb?.onPress();
            }}
            style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 14, borderRadius: forma.kapszula, backgroundColor: pressed ? '#FFD25E' : szin.sarga, justifyContent: 'center' })}
          >
            <T m={15} s={750} c={szin.sotet}>
              {j.gomb.cim}
            </T>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

/** Drawn inside every bottom sheet's Modal: the same toast, above the sheet. */
export function JelzesReteg() {
  const a = useContext(JelzesAllapotCtx);
  if (!a?.j) return null;
  return <JelzesDoboz j={a.j} o={a.o} rejt={a.rejt} fent />;
}
export function JelzesProvider({ children }: { children: ReactNode }) {
  const [j, setJ] = useState<Jelzes | null>(null);
  const o = useRef(new Animated.Value(0)).current;
  const idozito = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mutat = useCallback(
    (x: Jelzes | string) => {
      const jj = typeof x === 'string' ? { szoveg: x } : x;
      setJ(jj);
      AccessibilityInfo.announceForAccessibility?.(jj.szoveg);
      Animated.timing(o, { toValue: 1, duration: 160, useNativeDriver: !WEB }).start();
      if (idozito.current) clearTimeout(idozito.current);
      idozito.current = setTimeout(() => {
        Animated.timing(o, { toValue: 0, duration: 200, useNativeDriver: !WEB }).start(() => setJ(null));
      }, jj.ido ?? (jj.gomb ? 5000 : 2600));
    },
    [o],
  );
  const rejt = useCallback(() => {
    if (idozito.current) clearTimeout(idozito.current);
    o.setValue(0);
    setJ(null);
  }, [o]);
  // 11-19 javító kör 2: amíg egy alsó lap nyitva van, a jelzés CSAK a lap fölött (JelzesReteg) látszik – a lap alatti,
  // nem koppintható másolat nem marad a DOM-ban (képernyőolvasó / billentyűzet ne arra lépjen).
  const [lapok, setLapok] = useState(0);
  const lapValt = useCallback((d: number) => setLapok((x) => Math.max(0, x + d)), []);
  const allapot = useMemo(() => ({ j, o, rejt, lapValt }), [j, o, rejt, lapValt]);
  return (
    <JelzesCtx.Provider value={mutat}>
      <JelzesAllapotCtx.Provider value={allapot}>
        {children}
        {j && lapok === 0 ? <JelzesDoboz j={j} o={o} rejt={rejt} /> : null}
      </JelzesAllapotCtx.Provider>
    </JelzesCtx.Provider>
  );
}

/** Aktív fül a jelenlegi útvonalból (a fül-képernyők maguk is megadják). */
export function useAktivFul(): string {
  return aktivFulUtbol(usePathname());
}

/** Komponensen belüli szakaszos tartalom (Szakasz + Lap egy Fragmentben) v2-kártyává alakítása – mint a Kepernyo teszi. */
export function Kartyak({ children }: { children: ReactNode }) {
  return <>{kartyasit(children)}</>;
}
