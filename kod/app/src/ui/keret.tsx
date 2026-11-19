// Képernyő-keret: alap háttér, görgetés, lebegő fülsor a külön kerek Fotózás-gombbal, alsó lap (sheet), lépéssor,
// betöltés/hiba állapot, MINTA/DEMO jelzés, rövid visszajelzés (toast).
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type Ref } from 'react';
import { AccessibilityInfo, ActivityIndicator, Animated, Easing, Keyboard, Modal, PixelRatio, Platform, Pressable, ScrollView, useWindowDimensions, View, type ScrollViewInstance, type ScrollViewProps, type StyleProp, type ViewStyle } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import type { Me, Message, OnboardingState, RequestSummary } from '../_shared/api';
import { get } from '../api/http';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, usePathname } from 'expo-router';
import * as Haptics from 'expo-haptics';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { MINTA_MOD } from '../config';
import { KERET_SZELESSEG, keretStilus } from '../lib/webkeret';
import { mozgasKi } from '../lib/mozgas';
import { maiNap } from '../lib/format';
import { utEpit } from '../lib/ut';
import { arnyek, forma, szin } from '../theme/tokens';
import { GombM, Lap } from './alap';
import { Ikon3d, KeszJel, type Ikon3dNev } from './kepek';
import { useAuth } from '../auth/AuthProvider';
import { useZarolt } from './Zarolt';
import { T } from './T';

export const FULSOR_MAGASSAG = 64;

// ---------- fülsor ----------
const FULEK: { kulcs: string; cim: string; ikon: Ikon3dNev; ut: string; skala: number }[] = [
  { kulcs: 'fooldal', cim: 'Főoldal', ikon: 'fooldal', ut: '/', skala: 1 },
  { kulcs: 'dosszie', cim: 'Dosszié', ikon: 'dosszie', ut: '/dosszie', skala: 0.965 },
  { kulcs: 'uzenetek', cim: 'Üzenetek', ikon: 'uzenetek', ut: '/uzenetek', skala: 1.11 },
  { kulcs: 'fiok', cim: 'Fiók', ikon: 'fiok', ut: '/fiok', skala: 0.93 },
];

function valasztasRezges() {
  if (Platform.OS !== 'web') void Haptics.selectionAsync().catch(() => undefined);
}

/** Natívan a nyitott billentyűzet idejére a fülsor elbújik (SPEC §26.5.1; Android adjustResize). */
function useBillentyuzet(): boolean {
  const [nyitva, setNyitva] = useState(false);
  useEffect(() => {
    if (Platform.OS === 'web') return;
    const a = Keyboard.addListener('keyboardDidShow', () => setNyitva(true));
    const b = Keyboard.addListener('keyboardDidHide', () => setNyitva(false));
    return () => {
      a.remove();
      b.remove();
    };
  }, []);
  return nyitva;
}

// A fülsor csak a gyorsítótárból olvas (nem kérdez a szervertől): ha a képernyő már betöltötte, látszik a szám.
const passziv = { enabled: false } as const;

/** Bekötés alatt (SPEC §26.5.1): a Főoldal-fülön a teendők száma, az Üzeneteken az olvasatlanok; a Fotózás gomb csak
 *  a könyvelő nyitott dokumentum-kérésére tölt fel, különben a zárolt lapot mutatja. */
/** A könyvelő nyitott dokumentum-kérése: bekötés alatt csak erre lehet feltölteni (SPEC §26.5.2 'feltoltes'). */
function nyitottDokumentumKeres(items: RequestSummary[] | undefined): RequestSummary | undefined {
  return items?.find((r) => r.direction === 'konyvelotol' && r.type === 'dokumentum' && (r.status === 'nyitott' || r.status === 'folyamatban'));
}

function useFulAllapot() {
  // 'me' is FETCHED here (not only read from the cache): a screen opened cold (web reload, push tap, share intent)
  // that does not call useMe itself must still know whether the client is restricted (review k3c2).
  const bent = useAuth().allapot === 'bent';
  const me = useQuery<Me>({ queryKey: ['me'], queryFn: () => get<Me>('/me'), enabled: bent, staleTime: 60_000 });
  const korlatozott = me.data?.client?.lifecycle === 'bekotes_alatt';
  // Bekötés alatt a fülsor maga is lekéri (percenként legfeljebb egyszer) a bekötést és a kéréseket, hogy a Főoldal
  // jelvénye és a Fotózás gomb felirata minden képernyőn igaz legyen, ne csak ott, ahol épp a tárban van.
  const onb = useQuery<OnboardingState>({ queryKey: ['onboarding'], queryFn: () => get<OnboardingState>('/client/onboarding'), enabled: korlatozott, staleTime: 60_000 });
  const ker = useQuery<{ items: RequestSummary[] }>({ queryKey: ['keresek'], queryFn: () => get<{ items: RequestSummary[] }>('/client/requests'), enabled: korlatozott, staleTime: 60_000 });
  const uz = useQuery<{ items: Message[] }>({ queryKey: ['uzenetek'], ...passziv });
  // SPEC §27.4.2 (k3_kor2 tulaj 11): a jelvény = a sáv „Még N dolog” = a zárt lap „a tiéd” = journey.todoCount.
  const keresekDb = (ker.data?.items ?? []).filter((k) => k.direction === 'konyvelotol' && (k.status === 'nyitott' || k.status === 'folyamatban')).length;
  const fooldal = korlatozott && onb.data ? (onb.data.journey?.todoCount ?? utEpit({ o: onb.data, keresekDb, ma: maiNap() }).todoCount) : 0;
  const uzenetek = (uz.data?.items ?? []).filter((m) => m.sender !== 'en' && m.sender !== 'rendszer' && !m.readByClientAt).length;
  return { korlatozott, fooldal, uzenetek, nyitottKeres: korlatozott ? nyitottDokumentumKeres(ker.data?.items) : undefined };
}

function Jelveny({ n }: { n: number }) {
  if (!n) return null;
  return (
    <View style={{ position: 'absolute', top: 2, left: '55%', minWidth: 20, height: 20, paddingHorizontal: 5, borderRadius: 10, backgroundColor: szin.borostyanAlap, borderWidth: 1.5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
      <T m={11.5} s={750} lh={1} c={szin.borostyanSzoveg} szam>
        {n > 9 ? '9+' : n}
      </T>
    </View>
  );
}

export function Fulsor({ aktiv }: { aktiv: string }) {
  const ins = useSafeAreaInsets();
  const billentyuzet = useBillentyuzet();
  const allapot = useFulAllapot();
  const qc = useQueryClient();
  const zarolt = useZarolt();
  // 360 pt alatt (pl. 320-as kijelző) vagy nagy rendszer-betűméretnél a feliratok összeérnének: kisebb betű, szűkebb
  // oldalsáv, és a fül-feliratok legfeljebb 110%-ig nőnek (a teljes név az akadálymentes címkében marad).
  const { width } = useWindowDimensions();
  const nagyBetu = PixelRatio.getFontScale() > 1.15;
  const szuk = Math.min(width, 480) < 360 || nagyBetu;
  const alul = Platform.OS === 'web' ? 20 : Math.max(ins.bottom, 12) + 8;
  if (billentyuzet) return null;
  const fotozas = async () => {
    if (!allapot.korlatozott) return router.push('/fotozas');
    // Bekötés alatt csak a könyvelő kérésére lehet feltölteni (SPEC §26.5.2 'feltoltes': csak kérésre).
    try {
      const k = await qc.fetchQuery({ queryKey: ['keresek'], queryFn: () => get<{ items: RequestSummary[] }>('/client/requests'), staleTime: 30_000 });
      const nyitott = nyitottDokumentumKeres(k.items);
      if (nyitott) return router.push({ pathname: '/feltoltes', params: { keres: nyitott.id, kategoria: /kivonat/i.test(nyitott.title) ? 'bankszamlakivonat' : 'egyeb' } });
    } catch {
      /* ha nem érjük el, a zárolt lapot mutatjuk */
    }
    zarolt({ feature: 'feltoltes' });
  };
  const jelvenyek: Record<string, number> = { fooldal: allapot.fooldal, uzenetek: allapot.uzenetek };
  return (
    <>
      {/* fátyol: a fülsor felső élétől lefelé teljesen fed, fölötte 12 pt-os átmenet */}
      <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: alul + FULSOR_MAGASSAG + 12 }}>
        <Svg width="100%" height={12}>
          <Defs>
            <LinearGradient id="fatyol" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0" stopColor={szin.alap} stopOpacity={0} />
              <Stop offset="1" stopColor={szin.alap} stopOpacity={1} />
            </LinearGradient>
          </Defs>
          <Rect x={0} y={0} width="100%" height={12} fill="url(#fatyol)" />
        </Svg>
        <View style={{ flex: 1, backgroundColor: szin.alap }} />
      </View>
      <View style={{ position: 'absolute', left: szuk ? 8 : 14, right: szuk ? 8 : 14, bottom: alul, height: FULSOR_MAGASSAG, flexDirection: 'row', gap: szuk ? 6 : 10 }}>
        {/* only the four tabs form the tablist; the round Fotózás button next to it is a plain button (review k3c2) */}
        <View
          accessibilityRole="tablist"
          style={{
            flex: 1,
            flexDirection: 'row',
            padding: 5,
            borderRadius: 999,
            backgroundColor: 'rgba(255,255,255,0.94)',
            borderWidth: 1,
            borderColor: 'rgba(16,21,60,0.08)',
            ...arnyek.lebego,
          }}
        >
          {FULEK.map((f) => {
            const on = f.kulcs === aktiv;
            return (
              <Pressable
                key={f.kulcs}
                accessibilityRole="tab"
                accessibilityLabel={jelvenyek[f.kulcs] ? (f.kulcs === 'fooldal' ? `${f.cim}, még ${jelvenyek[f.kulcs]} teendő` : `${f.cim}, ${jelvenyek[f.kulcs]} új`) : f.cim}
                accessibilityState={{ selected: on }}
                // react-native-web 0.21 nem írja ki az accessibilityState-et: a weben az aria-selected jelzi az aktív fület.
                aria-selected={on}
                onPress={() => {
                  valasztasRezges();
                  if (!on) router.navigate((f.kulcs === 'fooldal' && allapot.korlatozott ? '/bekotes' : f.ut) as never);
                }}
                style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 1 }}
              >
                {/* a nagyított ikon (Üzenetek 1,11×) a 36 pt-os fájlból jön: csak lefelé méretezünk (TERV A6) */}
                <Ikon3d nev={f.ikon} pt={28} forrasPt={28 * f.skala} arnyektalan={false} style={{ transform: [{ scale: f.skala }] }} />
                <T m={szuk ? 10.5 : 11.5} s={on ? 750 : 550} lh={1.25} c={on ? szin.tintakek : szin.halvany} ls={szuk ? -0.02 : -0.005} numberOfLines={1} maxFontSizeMultiplier={1.1}>
                  {f.cim}
                </T>
                {on ? <View style={{ position: 'absolute', bottom: -2, width: 24, height: 4, borderRadius: 2, backgroundColor: szin.fulAktiv }} /> : null}
                <Jelveny n={jelvenyek[f.kulcs] ?? 0} />
              </Pressable>
            );
          })}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={
            !allapot.korlatozott
              ? 'Fotózás: irat lefotózása'
              : allapot.nyitottKeres
                ? `Fotózás: ${allapot.nyitottKeres.title} feltöltése, a könyvelőd kérte`
                : 'Fotózás: a bekötés után nyílik meg. Addig csak a könyvelőd kérésére tölthetsz fel.'
          }
          onPress={() => void fotozas()}
          style={({ pressed }) => [
            {
              width: 64,
              height: 64,
              borderRadius: 32,
              backgroundColor: '#fff',
              borderWidth: 3,
              borderColor: szin.tintakek,
              alignItems: 'center',
              justifyContent: 'center',
              ...arnyek.lebego,
            },
            pressed && { backgroundColor: '#F2F5FA' },
          ]}
        >
          <Ikon3d nev="fotozas" pt={34} style={{ marginTop: -3, marginBottom: -2 }} />
          <T m={szuk ? 9.5 : 10.5} s={700} lh={1.2} ls={-0.01} numberOfLines={1} maxFontSizeMultiplier={1.1}>
            Fotózás
          </T>
        </Pressable>
      </View>
    </>
  );
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
  ...p
}: {
  children: ReactNode;
  fejlec?: ReactNode;
  ful?: string;
  tartalomStilus?: StyleProp<ViewStyle>;
  frissit?: () => void;
  frissul?: boolean;
  gorget?: boolean;
  /** A görgető, ha a képernyő egy laphoz akar görgetni (pl. „Mi kell még?” → a következő lépés). */
  gorgetoRef?: Ref<ScrollViewInstance>;
} & ScrollViewProps) {
  const ins = useSafeAreaInsets();
  const alsoTer = ful ? FULSOR_MAGASSAG + 56 + (Platform.OS === 'web' ? 0 : ins.bottom) : 40 + ins.bottom;
  const tartalom = (
    <>
      {fejlec}
      <View style={[{ paddingHorizontal: forma.margo, paddingTop: 14, paddingBottom: alsoTer }, tartalomStilus]}>{children}</View>
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
      {ful ? <Fulsor aktiv={ful} /> : null}
      <MintaJel />
    </View>
  );
}

/** Egyszerű fejléc fülsor nélküli képernyőkre: szöveges vissza-link + cím (05 stílus). */
export function CimSor({ vissza, visszaCim, cim, al }: { vissza?: () => void; visszaCim?: string; cim: string; al?: string }) {
  const ins = useSafeAreaInsets();
  return (
    <View style={{ paddingTop: Platform.OS === 'web' ? 10 : ins.top + 2 }}>
      {visszaCim ? (
        <Pressable accessibilityRole="link" onPress={vissza ?? (() => (router.canGoBack() ? router.back() : router.replace('/')))} hitSlop={6} style={{ height: 48, justifyContent: 'center', paddingHorizontal: 20, alignSelf: 'flex-start' }}>
          <T m={16.5} s={500} c={szin.tintakekSzoveg} alahuz>
            {visszaCim}
          </T>
        </Pressable>
      ) : null}
      <View style={{ paddingTop: 6, paddingHorizontal: 20, paddingBottom: 2 }}>
        <T m={28} s={700} lh={1.15} ls={-0.025} accessibilityRole="header">
          {cim}
        </T>
        {al ? (
          <T m={16} lh={1.5} c={szin.halvanyAlapon} style={{ marginTop: 8 }}>
            {al}
          </T>
        ) : null}
      </View>
    </View>
  );
}

export function vissza(alap = '/') {
  if (router.canGoBack()) router.back();
  else router.replace(alap as never);
}

// ---------- MINTA / DEMO jelzés ----------
let demoJel = false;
const demoFigyelok = new Set<(b: boolean) => void>();
/** A szerver DEMO módját (config.demo / home.demo) itt jelezzük minden képernyőn. */
export function demoBeallit(b: boolean) {
  if (b === demoJel) return;
  demoJel = b;
  demoFigyelok.forEach((f) => f(b));
}
export function MintaJel() {
  const ins = useSafeAreaInsets();
  const [demo, setDemo] = useState(demoJel);
  useEffect(() => {
    demoFigyelok.add(setDemo);
    return () => {
      demoFigyelok.delete(setDemo);
    };
  }, []);
  if (!MINTA_MOD && !demo) return null;
  return (
    <View
      pointerEvents="none"
      style={{ position: 'absolute', top: Platform.OS === 'web' ? 6 : ins.top + 2, right: 10, height: 20, paddingHorizontal: 7, borderRadius: 5, backgroundColor: szin.borostyanAlap, justifyContent: 'center' }}
      accessibilityLabel={MINTA_MOD ? 'Minta mód: kitalált adatok, szerver nélkül' : 'Demó mód: nem valódi fizetés és adat'}
    >
      <T m={11} s={750} lh={1.2} c={szin.borostyanSzoveg} ls={0.04}>
        {MINTA_MOD ? 'MINTA' : 'DEMO'}
      </T>
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
            Animated.spring(y, { toValue: 0, useNativeDriver: Platform.OS !== 'web', damping: 26, stiffness: 220, mass: 1, overshootClamping: true }),
            Animated.timing(o, { toValue: 1, duration: 220, useNativeDriver: Platform.OS !== 'web' }),
          ]).start();
        } else if (mutat) {
          Animated.parallel([
            Animated.timing(y, { toValue: 800, duration: rm ? 0 : 220, easing: Easing.in(Easing.quad), useNativeDriver: Platform.OS !== 'web' }),
            Animated.timing(o, { toValue: 0, duration: rm ? 0 : 200, useNativeDriver: Platform.OS !== 'web' }),
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
        <View style={[{ flex: 1, justifyContent: 'flex-end' }, keretStilus]} pointerEvents="box-none">
          <Animated.View
            accessibilityViewIsModal
            style={[
              {
                backgroundColor: szin.lap,
                borderTopLeftRadius: forma.sheet,
                borderTopRightRadius: forma.sheet,
                paddingTop: 20,
                paddingHorizontal: 20,
                paddingBottom: 34 + (Platform.OS === 'web' ? 0 : ins.bottom),
                maxHeight: '92%',
                transform: [{ translateY: y }],
                ...arnyek.sheet,
              },
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
                style={{ position: 'absolute', top: 16, right: 16, height: 36, paddingHorizontal: 14, borderRadius: forma.gomb, backgroundColor: szin.nyomott, justifyContent: 'center', zIndex: 2 }}
              >
                <T m={15} s={600} ls={-0.005}>
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
              {children}
            </ScrollView>
            {lab ? <View style={{ borderTopWidth: 1, borderTopColor: szin.hajszal, marginHorizontal: -20, paddingHorizontal: 20, paddingTop: 2, backgroundColor: szin.lap }}>{lab}</View> : null}
          </Animated.View>
        </View>
        <JelzesReteg />
      </View>
    </Modal>
  );
}

// ---------- lépéssor (02 „Hol tartunk”, 05 „Hol tart”) ----------
export interface Lepes {
  cim: string;
  al?: string;
  allapot: 'kesz' | 'most' | 'var';
}
export function Lepessor({ lepesek, meret = 24, erosMost = true }: { lepesek: Lepes[]; meret?: number; erosMost?: boolean }) {
  return (
    <View style={{ paddingTop: 10, paddingHorizontal: 18, paddingBottom: 8 }}>
      {lepesek.map((l, i) => {
        const utolso = i === lepesek.length - 1;
        const kovKesz = l.allapot === 'kesz';
        return (
          <View key={i} style={{ flexDirection: 'row', gap: 14, paddingTop: 8, paddingBottom: 10 }} accessibilityLabel={`${i + 1}. ${l.cim}${l.al ? ', ' + l.al : ''}, ${l.allapot === 'kesz' ? 'kész' : l.allapot === 'most' ? 'most tart itt' : 'még hátra van'}`}>
            {!utolso ? (
              <View style={{ position: 'absolute', left: meret / 2 - 1, top: 8 + meret + 2, bottom: -8, width: 2, backgroundColor: kovKesz ? 'rgba(122,98,217,0.4)' : szin.keret }} />
            ) : null}
            <View style={{ width: meret, alignItems: 'center' }}>
              {l.allapot === 'kesz' ? (
                <KeszJel pt={meret} />
              ) : (
                <View style={{ width: meret - 1, height: meret - 1, borderRadius: meret, marginTop: 0.5, backgroundColor: l.allapot === 'most' ? szin.tintakek : szin.alap, alignItems: 'center', justifyContent: 'center' }}>
                  <T m={meret > 22 ? 13 : 12.5} s={750} lh={1} c={l.allapot === 'most' ? '#fff' : szin.tinta} szam>
                    {i + 1}
                  </T>
                </View>
              )}
            </View>
            <View style={{ flex: 1 }}>
              <T m={l.allapot === 'most' && erosMost ? 17 : meret > 22 ? 15.5 : 16} s={l.allapot === 'most' && erosMost ? 650 : meret > 22 ? 400 : l.allapot === 'var' ? 600 : 650} lh={1.35} c={l.allapot === 'most' || meret <= 22 ? (l.allapot === 'var' ? szin.halvany : szin.tinta) : szin.halvany}>
                {l.cim}
              </T>
              {l.al ? (
                <T m={l.allapot === 'most' && erosMost ? 15 : 14} lh={1.4} c={l.allapot === 'most' && erosMost ? szin.tinta : szin.halvany} style={{ marginTop: 1 }}>
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

// ---------- betöltés, hiba, üres ----------
export function Betolt({ szoveg = 'Betöltjük…' }: { szoveg?: string }) {
  return (
    <View style={{ paddingVertical: 48, alignItems: 'center', gap: 12 }} accessibilityLiveRegion="polite">
      <ActivityIndicator color={szin.tintakek} />
      <T m={15} c={szin.halvanyAlapon}>
        {szoveg}
      </T>
    </View>
  );
}
export function Hiba({ hiba, ujra }: { hiba: unknown; ujra?: () => void }) {
  const uzenet = hiba instanceof Error ? hiba.message : 'Valami elromlott.';
  return (
    <Lap belso style={{ marginTop: 12 }}>
      <T m={17} s={650} lh={1.4}>
        Most nem sikerült betölteni.
      </T>
      <T m={15} c={szin.halvany} lh={1.5} style={{ marginTop: 4, marginBottom: ujra ? 14 : 0 }}>
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
  // Over a bottom sheet the toast sits at the TOP of the screen (on the dim curtain), never on the sheet's cards
  // (11-19 javítás: the "Visszavonom" toast covered the highlighted "Intézzétek helyettem" card).
  const hely = fent ? { top: (Platform.OS === 'web' ? 12 : ins.top + 8) } : { bottom: 110 + ins.bottom };
  return (
    <Animated.View pointerEvents={j.gomb ? 'box-none' : 'none'} style={{ position: 'absolute', left: 16, right: 16, ...hely, alignItems: 'center', opacity: o, zIndex: 1000 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: szin.tintakek, borderRadius: 14, paddingVertical: j.gomb ? 6 : 12, paddingLeft: 16, paddingRight: j.gomb ? 6 : 16, maxWidth: 440, ...arnyek.lebego }}>
        {j.kesz ? <KeszJel pt={22} /> : null}
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
            style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 14, borderRadius: forma.gomb, backgroundColor: pressed ? 'rgba(255,255,255,0.28)' : 'rgba(255,255,255,0.16)', justifyContent: 'center' })}
          >
            <T m={15} s={700} c="#fff" alahuz>
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
      Animated.timing(o, { toValue: 1, duration: 160, useNativeDriver: Platform.OS !== 'web' }).start();
      if (idozito.current) clearTimeout(idozito.current);
      idozito.current = setTimeout(() => {
        Animated.timing(o, { toValue: 0, duration: 200, useNativeDriver: Platform.OS !== 'web' }).start(() => setJ(null));
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
  const p = usePathname();
  if (p.startsWith('/dosszie')) return 'dosszie';
  if (p.startsWith('/fiok') || p.startsWith('/gyik') || p.startsWith('/ertesitesek')) return 'fiok';
  if (p.startsWith('/uzenetek')) return 'uzenetek';
  return 'fooldal';
}
