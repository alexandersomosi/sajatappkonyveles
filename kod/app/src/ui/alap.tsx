// Közös elemek – v2 dizájn (k8, tulaj 11-20/21; minta: dizajn/C5_v2/v2.css). Szürke háttér, minden szakasz külön fehér
// kártya (r 20, finom árnyék), kék gradiens fejléc alul kerekítve a felirat-logóval, sárga főgomb sötét felirattal
// (képernyőnként egy), fehér keretes / kék pirula másodlagos gomb, nagybetűs szürke szakaszcím, Fluent ikonok semleges
// csempében. Halvány, nagy pasztell doboz nincs: kiemelés = fehér alap + 4 pt telt bal sáv (Jelzo, jelzoDoboz).
// Az aláírások a régiek (a képernyők változatlanul hívják őket). A régi C-változat: _regi/elotte_k8_A/src/ui/alap.tsx.
import { createContext, useContext, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, RadialGradient, Rect, Stop } from 'react-native-svg';
import { Csempe, Logo, VezerloIkon, fejGradiens, javasoltCsempe } from '../_shared/v2/rn';
import { useAsztali } from '../lib/elrendezes';
import { arnyek, forma, szin } from '../theme/tokens';
import { DemoPirula } from './demoAllapot';
import { Ikon3d, KeszJel, ujIkon, type IkonNev as Ikon3dNev } from './kepek';
import { Nyomhato } from './mozgas/Benyomodo';
import { T } from './T';
import { useTeljes } from './teljes';

const WEB = Platform.OS === 'web';
/** A kártyafej alatti tartalom behúzása (csempe 42 + köz 12): a szöveg a cím vonalán kezdődik. */
export const BEHUZAS = 54;
/** Weben a hover/benyomódás finom átmenete (csökkentett mozgásnál a globális CSS kikapcsolja: lib/webStilus.ts). */
const ATMENET = WEB ? ({ transitionProperty: 'background-color, box-shadow, transform, border-color', transitionDuration: '200ms', transitionTimingFunction: 'cubic-bezier(0.22, 1, 0.36, 1)' } as ViewStyle) : null;

// ---------- fejléc ----------
/** A kék fejléc háttere: 160°-os gradiens + két halvány díszkör (v2.css .fej::before/::after). Díszítés, rejtett. */
function FejHatter({ kis }: { kis?: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, '');
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} aria-hidden>
      <Svg width="100%" height="100%" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id={`fg${id}`} x1="0.32" y1="0" x2="0.68" y2="1">
            {fejGradiens.szinek.map((c, i) => (
              <Stop key={c} offset={fejGradiens.helyek[i]} stopColor={c} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill={`url(#fg${id})`} />
      </Svg>
      <Svg width={320} height={320} style={{ position: 'absolute', right: -140, top: -70 }}>
        <Defs>
          <RadialGradient id={`fk${id}`} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.12} />
            <Stop offset="0.7" stopColor="#FFFFFF" stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect x={0} y={0} width={320} height={320} fill={`url(#fk${id})`} />
      </Svg>
      <View style={{ position: 'absolute', width: 230, height: 230, right: -70, top: kis ? 40 : 110, borderRadius: 115, borderWidth: 30, borderColor: 'rgba(255,255,255,0.05)' }} />
    </View>
  );
}

/** A fejléc kerek vissza-gombja (40 pt, áttetsző fehér kör, nyíl). Felirata a felolvasónak a `cim`. */
export function VisszaKor({ cim, onPress }: { cim: string; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={cim}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        { width: 44, height: 44, borderRadius: 22, backgroundColor: pressed ? 'rgba(255,255,255,0.28)' : hovered ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.16)', alignItems: 'center', justifyContent: 'center' },
        ATMENET,
      ]}
    >
      <VezerloIkon nev="vissza" pt={22} szin="#fff" />
    </Pressable>
  );
}

/** Fejléc-környezet: a gyerekek tudják, hogy gépen a hős sávban vannak (nagyobb cím). */
export const FejlecCtx = createContext<{ asztali: boolean }>({ asztali: false });
export const useFejlec = () => useContext(FejlecCtx);

/**
 * A kék fejléc (v2 .fej). Telefonon teljes szélességű, alul 26-os (kicsi: 24-es) kerekítéssel, felül a felirat-logó és a
 * DEMO pirula; `vissza` esetén kerek vissza-gomb balra, kis logó jobbra (v2 .fej.kis). Gépen (≥ 1024 pt) a tartalomoszlop
 * tetején lekerekített hős sáv (r 24), logó nélkül (a logó a bal menüben van).
 * A gyerekek saját vízszintes margót adnak (16 pt) – a régi hívások így változatlanok.
 */
export function Fejlec({
  children,
  alsoTer = 24,
  style,
  felsoTer = true,
  vissza,
  logo = true,
  kis,
}: {
  children?: ReactNode;
  rozX?: number;
  rozY?: number;
  alsoTer?: number;
  style?: StyleProp<ViewStyle>;
  felsoTer?: boolean;
  /** Kerek vissza-gomb a bal felső sarokban (aloldalak). */
  vissza?: { cim: string; onPress: () => void } | null;
  /** A felirat-logó a fejléc tetején (telefonon). */
  logo?: boolean;
  /** Kisebb alsó kerekítés (aloldalak). */
  kis?: boolean;
}) {
  const ins = useSafeAreaInsets();
  const asztali = useAsztali();
  const felul = felsoTer ? (WEB ? 12 : ins.top + 4) : 0;
  const r = asztali ? 24 : kis || vissza ? 24 : 26;
  const fejSor = vissza ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 44, paddingHorizontal: asztali ? 20 : 16 }}>
      <VisszaKor cim={vissza.cim} onPress={vissza.onPress} />
      <View style={{ flex: 1 }} />
      <DemoPirula kicsi />
      {!asztali && logo ? <Logo meret={22} feher /> : null}
    </View>
  ) : asztali ? null : logo ? (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 46, paddingHorizontal: 18 }}>
      <Logo meret={30} feher />
      <DemoPirula />
    </View>
  ) : null;
  return (
    <FejlecCtx.Provider value={{ asztali }}>
      <View
        style={[
          asztali
            ? { borderRadius: r, marginBottom: 22, ...arnyek.hos }
            : { borderBottomLeftRadius: r, borderBottomRightRadius: r, ...arnyek.fejlec },
          { backgroundColor: szin.tintakek },
          style,
        ]}
      >
        <View style={[{ overflow: 'hidden', paddingTop: asztali ? 22 : felul, paddingBottom: asztali ? Math.max(alsoTer, 26) : alsoTer }, asztali ? { borderRadius: r } : { borderBottomLeftRadius: r, borderBottomRightRadius: r }]}>
          <FejHatter kis={kis || !!vissza} />
          {asztali && !vissza ? (
            <View style={{ position: 'absolute', top: 22, right: 24, zIndex: 2 }}>
              <DemoPirula kicsi />
            </View>
          ) : null}
          {fejSor}
          <View style={asztali ? { paddingHorizontal: 20, paddingRight: vissza ? 20 : 96 } : null}>{children}</View>
        </View>
      </View>
    </FejlecCtx.Provider>
  );
}

// ---------- kártya ----------
/** A kártyarács cellája (gépen): a benne lévő első kártya kitölti a cella magasságát. */
export const RacsCellaCtx = createContext(false);

/**
 * Tartalom-kártya (v2 .k): tiszta fehér, r 20 (gépen 22), finom árnyék, 12 pt köz alatta. A hívó adja a belső teret
 * (`belso`: 16/14). Az alsó lapon (sheet) belül árnyék nélkül. Gépen egér fölött picit megemelkedik (k8 #10).
 */
export function Lap({ children, style, belso = false, jelzo }: { children: ReactNode; style?: StyleProp<ViewStyle>; belso?: boolean; kotott?: boolean; elso?: boolean; /** 4 pt-es telt bal sáv (kiemelés pasztell helyett). */ jelzo?: string }) {
  const keretben = useTeljes();
  const asztali = useAsztali();
  const cella = useContext(RacsCellaCtx);
  const [felette, setFelette] = useState(false);
  const emel = asztali && keretben && felette;
  return (
    <RacsCellaCtx.Provider value={false}>
      <View
        {...(asztali && keretben ? { onPointerEnter: () => setFelette(true), onPointerLeave: () => setFelette(false) } : null)}
        style={[
          { backgroundColor: szin.lap, borderRadius: asztali ? 22 : forma.lap, marginBottom: 12, overflow: 'hidden' },
          keretben ? (emel ? arnyek.kartyaEmelt : arnyek.kartya) : null,
          ATMENET,
          emel ? { transform: [{ translateY: -2 }] } : null,
          jelzo ? { borderLeftWidth: 4, borderLeftColor: jelzo } : null,
          belso && { paddingVertical: asztali ? 20 : 16, paddingHorizontal: asztali ? 22 : 14 },
          style,
          cella ? { flex: 1, marginBottom: 0, marginTop: 0 } : null,
        ]}
      >
        {children}
      </View>
    </RacsCellaCtx.Provider>
  );
}

/** Figyelmeztető / tájékoztató doboz stílusa (a régi borostyán pasztell doboz helyett): fehér alap, 4 pt telt bal sáv,
 *  hajszál keret. `fajta`: figyelem (narancs), hiba (piros), info (kék), ok (zöld). */
export function jelzoDoboz(fajta: 'figyelem' | 'hiba' | 'info' | 'ok' = 'figyelem'): ViewStyle {
  const c = fajta === 'hiba' ? szin.veszely : fajta === 'info' ? szin.tintakek : fajta === 'ok' ? szin.zold : szin.narancs;
  return { backgroundColor: '#fff', borderWidth: 1, borderColor: szin.keret, borderLeftWidth: 4, borderLeftColor: c };
}

/** Szakaszcím (v2 .szakasz-cim): nagybetűs 14/700 szürke a háttéren, alatta legfeljebb egy mondat (.megj). Az ikon
 *  a v2-ben nem kerül a szakaszcím elé (a kártyákban van); a `jobbra` elem (pl. „Mi ez?”) marad. */
export function Szakasz({ cim, megj, style, jobbra }: { cim: string; megj?: string; style?: StyleProp<ViewStyle>; ikon?: Ikon3dNev; jobbra?: ReactNode; elso?: boolean }) {
  const keretben = useTeljes();
  if (!keretben) {
    // alsó lapon (sheet) belül: sima kártyacím (a régi nem-szakaszos változat)
    return (
      <View style={[{ paddingTop: 22, paddingBottom: megj ? 8 : 10, paddingHorizontal: 2 }, style]}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <T m={18} s={750} lh={1.3} ls={-0.012} accessibilityRole="header" style={{ flex: 1, minWidth: 0 }}>
            {cim}
          </T>
          {jobbra}
        </View>
        {megj ? (
          <T m={15} lh={1.4} c={szin.halvany} style={{ marginTop: 4 }}>
            {megj}
          </T>
        ) : null}
      </View>
    );
  }
  return (
    <View style={[{ paddingTop: 10, paddingBottom: megj ? 10 : 8, paddingHorizontal: 6 }, style]}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 24 }}>
        <T m={14} s={700} lh={1.3} ls={0.04} c={szin.halvany} accessibilityRole="header" style={{ flex: 1, minWidth: 0, textTransform: 'uppercase' }}>
          {cim}
        </T>
        {jobbra}
      </View>
      {megj ? (
        <T m={14} lh={1.45} c={szin.halvany} style={{ marginTop: 2 }}>
          {megj}
        </T>
      ) : null}
    </View>
  );
}

/** Kártyacím csempével (v2 .k + .tile + h2): a kártyák fejsora. */
export function KartyaFej({ ikon, cim, al, jobbra, style }: { ikon?: Ikon3dNev; cim: string; al?: ReactNode; jobbra?: ReactNode; style?: StyleProp<ViewStyle> }) {
  const asztali = useAsztali();
  return (
    <View style={[{ flexDirection: 'row', gap: asztali ? 16 : 12, alignItems: 'flex-start' }, style]}>
      {ikon ? <IkonCsempe nev={ikon} /> : null}
      <View style={{ flex: 1, minWidth: 0, paddingTop: ikon ? 2 : 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <T m={asztali ? 19 : 18.5} s={750} lh={1.25} ls={-0.015} accessibilityRole="header" style={{ flex: 1, minWidth: 0 }}>
            {cim}
          </T>
          {jobbra}
        </View>
        {typeof al === 'string' ? (
          <T m={15} lh={1.45} c={szin.szoveg2} style={{ marginTop: 4 }}>
            {al}
          </T>
        ) : (
          al
        )}
      </View>
    </View>
  );
}

/** Régi ikonnév csempében (v2 .tile): semleges #F1F3F9 alap, nagy ikon. */
export function IkonCsempe({ nev, meret = 'alap', style }: { nev: Ikon3dNev; meret?: 'kicsi' | 'alap' | 'nagy'; style?: StyleProp<ViewStyle> }) {
  const uj = ujIkon(nev);
  if (uj.fajta === 'emoji') return <Csempe nev={uj.nev} meret={meret} style={style} />;
  const m = meret === 'kicsi' ? 36 : meret === 'nagy' ? 64 : 42;
  return (
    <View style={[{ width: m, height: m, borderRadius: meret === 'kicsi' ? 11 : meret === 'nagy' ? 20 : 13, backgroundColor: szin.csempe, alignItems: 'center', justifyContent: 'center' }, style]}>
      <Ikon3d nev={nev} pt={m * 0.55} />
    </View>
  );
}

// ---------- gombok ----------
type GombProps = Omit<PressableProps, 'children' | 'style'> & { cim: string; ikon?: Ikon3dNev; tolt?: boolean; style?: StyleProp<ViewStyle>; magas?: number };

/** Elsődleges gomb (v2 .gomb): sárga #FFC93C, sötét 17/750 felirat, r 14, 52 pt, alsó él-árnyék; képernyőnként egy.
 *  Nyomásra benyomódik (0,97), gépen egér fölött kiemelődik. */
export function GombE({ cim, tolt, style, magas = 52, disabled, ikon, ...p }: GombProps) {
  const tiltva = disabled || tolt;
  const asztali = useAsztali();
  const m = asztali && magas === 52 ? 50 : magas;
  return (
    <Nyomhato
      accessibilityRole="button"
      disabled={tiltva}
      {...p}
      style={style}
      // gépen a fő gomb nem nyúlik a kártya teljes szélességére (A01/A53: kb. 280–420 pt)
      alapIgazitas={asztali ? 'flex-start' : 'stretch'}
      alap={({ pressed, hovered }) => [
        asztali ? { minWidth: 280 } : null,
        { minHeight: m, borderRadius: forma.gomb, backgroundColor: szin.sarga, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 22, paddingVertical: 4, flexDirection: 'row', gap: 8 },
        tiltva ? { backgroundColor: tolt ? szin.sarga : szin.letiltvaAlap } : (arnyek.gomb as ViewStyle),
        ATMENET,
        !tiltva && (pressed ? { backgroundColor: '#F7BD22' } : hovered ? { backgroundColor: '#FFD25E' } : null),
      ]}
    >
      {tolt ? <ActivityIndicator color={szin.sotet} /> : ikon ? <Ikon3d nev={ikon} pt={20} /> : null}
      {/* SPEC §28.K.10: nagy betűméretnél a fő gomb két sorra nőhet, a felirat soha nem csonkolódik */}
      <T m={m < 50 ? 16 : 17} s={750} c={disabled && !tolt ? szin.letiltvaSzoveg : szin.sotet} numberOfLines={2} kozep style={{ flexShrink: 1 }}>
        {cim}
      </T>
    </Nyomhato>
  );
}

/**
 * Másodlagos gomb. Kicsiben (< 48 pt, alap) a v2 kék pirula (.gomb-kis.masod: #E6EBFF alap, kék 15,5/750 felirat,
 * Fluent ikonnal) – kicsi, telt világos elem, nem nagy doboz. Nagyban (≥ 48 pt) a fehér, keretes .gomb-masod.
 */
export function GombM({ cim, ikon, tolt, style, magas = 42, disabled, ...p }: GombProps) {
  const nagy = magas >= 48;
  const tiltva = disabled || tolt;
  return (
    <Nyomhato
      accessibilityRole="button"
      disabled={tiltva}
      hitSlop={magas < 44 ? { top: (44 - magas) / 2, bottom: (44 - magas) / 2 } : undefined}
      {...p}
      style={style}
      alapIgazitas={nagy ? 'stretch' : 'flex-start'}
      alap={({ pressed, hovered }) => [
        nagy
          ? { minHeight: magas, borderRadius: forma.gomb, backgroundColor: pressed ? szin.hoverAlap : hovered ? '#F8F9FD' : '#fff', borderWidth: 1.5, borderColor: hovered ? szin.mezoKeret : szin.keret, paddingHorizontal: 18 }
          : { minHeight: magas, borderRadius: forma.kapszula, backgroundColor: pressed ? szin.gombMNyomott : hovered ? '#DCE3FF' : szin.gombMAlap, paddingLeft: ikon ? 13 : 16, paddingRight: 16 },
        { alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, maxWidth: '100%' },
        ATMENET,
        tiltva ? { opacity: 0.55 } : null,
      ]}
    >
      {tolt ? <ActivityIndicator color={nagy ? szin.sotet : szin.tintakek} /> : ikon ? <Ikon3d nev={ikon} pt={nagy ? 22 : 20} /> : null}
      <T m={nagy ? 16 : 15.5} s={nagy ? 700 : 750} c={nagy ? szin.sotet : szin.tintakek} numberOfLines={2} kozep style={{ flexShrink: 1 }}>
        {cim}
      </T>
    </Nyomhato>
  );
}

/** Veszélyes művelet gombja (v2 .gomb-veszely): fehér, halványpiros keret, piros 700-as felirat, teljes szélesség. */
export function GombV({ cim, tolt, style, disabled, ...p }: GombProps) {
  const tiltva = disabled || tolt;
  return (
    <Nyomhato
      accessibilityRole="button"
      disabled={tiltva}
      {...p}
      style={style}
      alap={({ pressed, hovered }) => [
        { minHeight: 50, borderRadius: forma.gomb, backgroundColor: pressed ? '#FFF1F0' : hovered ? '#FFF7F6' : '#fff', borderWidth: 1.5, borderColor: hovered ? szin.veszely : '#F4C7C3', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18 },
        ATMENET,
        tiltva ? { opacity: 0.55 } : null,
      ]}
    >
      {tolt ? <ActivityIndicator color={szin.veszely} /> : null}
      <T m={16} s={700} c={szin.veszely} kozep>
        {cim}
      </T>
    </Nyomhato>
  );
}

/** Szöveges gomb (v2 .link): kék 650-es, aláhúzott. */
export function GombSz({ cim, veszely, m = 15.5, style, c, ...p }: Omit<PressableProps, 'children' | 'style'> & { cim: string; veszely?: boolean; m?: number; style?: StyleProp<ViewStyle>; c?: string }) {
  return (
    <Pressable accessibilityRole="button" hitSlop={8} {...p} style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [{ paddingVertical: 10, alignSelf: 'flex-start', minHeight: 40, justifyContent: 'center' }, (pressed || hovered) && { opacity: pressed ? 0.6 : 0.8 }, style]}>
      <T m={m} s={650} lh={1.3} c={c ?? (veszely ? szin.veszely : szin.tintakekSzoveg)} alahuz>
        {cim}
      </T>
    </Pressable>
  );
}

/** A fejléc gombja (v2 .later): áttetsző fehér pirula, fehér 650-es felirat, Fluent ikonnal. */
export function GombSav({ cim, ikon, style, ...p }: Omit<PressableProps, 'children' | 'style'> & { cim: string; ikon?: Ikon3dNev; style?: StyleProp<ViewStyle> }) {
  return (
    <Nyomhato
      accessibilityRole="button"
      {...p}
      style={style}
      alapIgazitas="flex-start"
      alap={({ pressed, hovered }) => [
        { flexDirection: 'row', alignItems: 'center', gap: 7, minHeight: 40, paddingLeft: ikon ? 10 : 15, paddingRight: 15, borderRadius: forma.kapszula, backgroundColor: pressed ? 'rgba(255,255,255,0.3)' : hovered ? 'rgba(255,255,255,0.24)' : 'rgba(255,255,255,0.16)' },
        ATMENET,
      ]}
    >
      {ikon ? <Ikon3d nev={ikon} pt={22} /> : null}
      <T m={15} s={650} c="#fff">
        {cim}
      </T>
    </Nyomhato>
  );
}

/** Állapotcímke (v2 .cimke): kis pirula, narancs (alap) vagy piros (veszély) – kicsi, telt világos alapon. */
export function Cimke({ szoveg, veszely, ok, style }: { szoveg: string; veszely?: boolean; ok?: boolean; style?: StyleProp<ViewStyle> }) {
  const [hat, elo] = veszely ? [szin.veszelyAlap, szin.veszely] : ok ? [szin.zoldVil, szin.zold] : [szin.narancsVil, szin.narancs];
  return (
    <View style={[{ minHeight: 26, paddingHorizontal: 10, borderRadius: forma.kapszula, backgroundColor: hat, justifyContent: 'center', alignSelf: 'center' }, style]}>
      <T m={13} s={700} lh={1.2} c={elo} numberOfLines={1}>
        {szoveg}
      </T>
    </View>
  );
}

/** Állapot: sima szöveg, a szó félkövér; kész esetén előtte a zöld pipa. */
export function Allapot({ szo, utana, kesz, veszely, m = 14.5, style }: { szo: string; utana?: string; kesz?: boolean; veszely?: boolean; m?: number; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }, style]}>
      {kesz ? <KeszJel pt={m + 4.5} /> : null}
      <T m={m} lh={1.35} c={szin.halvany} style={{ flexShrink: 1 }}>
        <T m={m} s={650} lh={1.35} c={veszely ? szin.veszely : szin.tinta}>
          {szo}
        </T>
        {utana ? `, ${utana}` : ''}
      </T>
    </View>
  );
}

/** Felsorolás számozott, semleges korongokkal (v2 .lepes .p). */
export function Felsorolas({ elemek, style }: { elemek: string[]; style?: StyleProp<ViewStyle> }) {
  return (
    <View style={style}>
      {elemek.map((s, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: szin.nyomott, alignItems: 'center', justifyContent: 'center', marginTop: 0 }}>
            <T m={12.5} s={750} lh={1} c={szin.halvany}>
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

/** Vékony elválasztó a kártyán belül (#ECEFF6). */
export const Hajszal = ({ bal = 0, jobb = 0 }: { bal?: number; jobb?: number }) => (
  <View style={{ height: 1, backgroundColor: szin.hajszal, marginLeft: bal, marginRight: jobb }} />
);

/** Lista-sor (v2 .lsor): ikon kis csempében, cím 15,5/650, alcím 14 szürke, jobbra nyíl, ha koppintható; a sorok közt
 *  hajszálvonal. Az egész sor egy gomb; gépen egér fölött halvány kék-szürke alap. */
export function Sor({ ikon, kesz, cim, al, onPress, elso, minH = 60, cimSzin, cimSuly = 650, jobbra, label, zaroltOk, nyil }: {
  ikon?: Ikon3dNev; kesz?: boolean; cim: string; al?: ReactNode; onPress?: () => void; elso?: boolean; minH?: number; cimSzin?: string; cimSuly?: 500 | 600 | 650; jobbra?: ReactNode; label?: string;
  /** SPEC §26.5.3: a locked row stays focusable and opens the reason, but says "disabled" + the reason to screen readers. */
  zaroltOk?: string;
  /** Jobb oldali nyíl (alap: ha koppintható és nincs más a jobb oldalon). */
  nyil?: boolean;
}) {
  const ref = useRef<unknown>(null);
  // react-native-web 0.21 writes aria-disabled only from Pressable's own `disabled` (which would also block the press,
  // and a <button disabled> cannot be focused), and it drops accessibilityState/hint: so on the web the attribute is set
  // on the DOM node directly (a <button aria-disabled="true"> stays focusable and clickable), the reason is in the label.
  useEffect(() => {
    if (!WEB || !zaroltOk) return;
    (ref.current as unknown as { setAttribute?: (k: string, v: string) => void } | null)?.setAttribute?.('aria-disabled', 'true');
  });
  const mutatNyil = nyil ?? (!!onPress && !jobbra);
  return (
    <Pressable
      ref={ref as never}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole={onPress ? 'button' : undefined}
      accessibilityLabel={zaroltOk && WEB ? `${label ?? cim}. ${zaroltOk}` : label}
      {...(zaroltOk ? { accessibilityState: { disabled: true }, accessibilityHint: zaroltOk } : {})}
      style={({ pressed, hovered }: { pressed: boolean; hovered?: boolean }) => [
        { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, paddingHorizontal: 14, minHeight: minH },
        ATMENET,
        onPress && pressed ? { backgroundColor: '#EEF1F8' } : onPress && hovered ? { backgroundColor: szin.hoverAlap } : null,
      ]}
    >
      {!elso && <View style={{ position: 'absolute', top: 0, left: 14, right: 14, height: 1, backgroundColor: szin.hajszal }} />}
      {ikon ? (
        <View style={{ width: 36, height: 36 }}>
          <IkonCsempe nev={ikon} meret="kicsi" />
          {kesz ? (
            <View style={{ position: 'absolute', right: -6, top: -5, width: 19, height: 19, borderRadius: 10, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
              <KeszJel pt={16} />
            </View>
          ) : null}
        </View>
      ) : null}
      <View style={{ flex: 1, minWidth: 0 }}>
        <T m={15.5} s={cimSuly} lh={1.3} c={cimSzin ?? szin.tinta}>
          {cim}
        </T>
        {typeof al === 'string' ? (
          <T m={14} lh={1.35} c={szin.halvany} style={{ marginTop: 1 }}>
            {al}
          </T>
        ) : (
          al
        )}
      </View>
      {jobbra}
      {mutatNyil ? <VezerloIkon nev="chev" pt={18} szin={szin.dekorNyil} /> : null}
    </Pressable>
  );
}

/** Összeg (v2 .osszeg): tabulált számok 800-as súllyal, a „Ft” kisebb. */
export function Osszeg({ szoveg, m = 17, s = 800, c = szin.tinta, ftSzin }: { szoveg: string; m?: number; s?: 600 | 700 | 800; c?: string; ftSzin?: string }) {
  return (
    <T m={m} s={s} lh={1.2} c={c} szam ls={-0.01} numberOfLines={1}>
      {szoveg}
      <T m={Math.max(12, m * 0.72)} s={600} c={ftSzin ?? c}>
        {' Ft'}
      </T>
    </T>
  );
}

/** Vissza-link szövegként: „Vissza az októberi dossziéhoz”. */
export function Vissza({ cim, onPress, sotet }: { cim: string; onPress: () => void; sotet?: boolean }) {
  return (
    <Pressable accessibilityRole="link" onPress={onPress} hitSlop={6} style={({ pressed }) => [{ minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 4, alignSelf: 'flex-start', paddingHorizontal: 16 }, pressed && { opacity: 0.6 }]}>
      <VezerloIkon nev="chev-bal" pt={16} szin={sotet ? '#fff' : szin.tintakekSzoveg} />
      <T m={15.5} s={650} c={sotet ? '#fff' : szin.tintakekSzoveg} alahuz>
        {cim}
      </T>
    </Pressable>
  );
}

/** Szegmens (v2 .szegmens) a kék fejlécen: áttetsző fehér sín, a kiválasztott fehér. */
export function Szegmens({ elemek, aktiv, valt }: { elemek: { kulcs: string; cim: string }[]; aktiv: string; valt: (k: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', minHeight: 46, padding: 4, gap: 4, marginHorizontal: 16, marginTop: 12, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.14)' }} accessibilityRole="tablist">
      {elemek.map((e) => {
        const on = e.kulcs === aktiv;
        return (
          <Pressable key={e.kulcs} onPress={() => valt(e.kulcs)} accessibilityRole="tab" accessibilityState={{ selected: on }} aria-selected={on} style={[{ flex: 1, minHeight: 38, borderRadius: 10, backgroundColor: on ? '#fff' : 'transparent', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }, on ? arnyek.szegmens : null]}>
            <T m={14.5} s={on ? 700 : 650} c={on ? szin.tinta : '#fff'} numberOfLines={1}>
              {e.cim}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Hibasáv a kártyán (piros szöveg). */
export function HibaSzoveg({ szoveg, style }: { szoveg?: string | null; style?: StyleProp<ViewStyle> }) {
  if (!szoveg) return null;
  return (
    <View style={[{ marginTop: 8 }, style]} accessibilityLiveRegion="polite">
      <T m={14.5} s={600} c={szin.veszely} lh={1.4}>
        {szoveg}
      </T>
    </View>
  );
}

/** Jelölőnégyzet szöveggel (v2 .jelolo): 22 pt, r 7; bejelölve kék alapon fehér pipa. */
export function Pipa({ be, valt, children, style }: { be: boolean; valt: (b: boolean) => void; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return (
    <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: be }} aria-checked={be} onPress={() => valt(!be)} style={[{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', paddingVertical: 10, minHeight: 44 }, style]}>
      <View style={{ width: 24, height: 24, borderRadius: 7, borderWidth: be ? 0 : 2, borderColor: szin.mezoKeret, backgroundColor: be ? szin.tintakek : '#fff', alignItems: 'center', justifyContent: 'center', marginTop: 0 }}>
        {be ? <VezerloIkon nev="pipa" pt={17} szin="#fff" /> : null}
      </View>
      <View style={{ flex: 1 }}>{typeof children === 'string' ? <T m={15.5} lh={1.45}>{children}</T> : children}</View>
    </Pressable>
  );
}

/** Választó (rádió) kártyák (v2 .valaszto): r 16, 1,5 pt keret; a kiválasztott kék keretes, kék kör. */
export function Valaszto<K extends string>({ elemek, ertek, valt }: { elemek: { kulcs: K; cim: string; al?: string }[]; ertek: K | null; valt: (k: K) => void }) {
  return (
    <View style={{ gap: 10 }} accessibilityRole="radiogroup">
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
            style={({ hovered }: { pressed: boolean; hovered?: boolean }) => [{ borderRadius: 16, borderWidth: 1.5, borderColor: on ? szin.tintakek : hovered ? szin.mezoKeret : szin.keret, backgroundColor: on ? szin.kekValasztott : '#fff', padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 }, ATMENET]}
          >
            <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: 2, borderColor: on ? szin.tintakek : szin.mezoKeret, backgroundColor: on ? szin.tintakek : '#fff', alignItems: 'center', justifyContent: 'center' }}>
              {on ? <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: '#fff' }} /> : null}
            </View>
            <View style={{ flex: 1 }}>
              <T m={15.5} s={700} lh={1.35}>
                {e.cim}
              </T>
              {e.al ? (
                <T m={14} c={szin.halvany} lh={1.4} style={{ marginTop: 1 }}>
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

/** Kapcsoló (v2 .kapcsolo, 48 × 28). */
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
      style={{ flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, opacity: tilt ? 0.5 : nyomva ? 0.8 : 1 }}
    >
      <View style={{ flex: 1 }}>
        <T m={15.5} s={650} lh={1.35}>
          {cim}
        </T>
        {al ? (
          <T m={14} c={szin.halvany} lh={1.4} style={{ marginTop: 2 }}>
            {al}
          </T>
        ) : null}
      </View>
      <View style={[{ width: 48, height: 28, borderRadius: 14, backgroundColor: be ? szin.tintakek : szin.mezoKeret, padding: 3, alignItems: be ? 'flex-end' : 'flex-start' }, ATMENET]}>
        <View style={{ width: 22, height: 22, borderRadius: 11, backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(16,21,43,.25)' }} />
      </View>
    </Pressable>
  );
}

/** Kiemelt, fehér tájékoztató sor 4 pt-es telt bal sávval (a régi borostyán / kék pasztell dobozok helyett). */
export function Jelzo({ children, fajta = 'figyelem', style }: { children: ReactNode; fajta?: 'figyelem' | 'hiba' | 'info' | 'ok'; style?: StyleProp<ViewStyle> }) {
  return <View style={[{ borderRadius: 14, padding: 14, marginBottom: 12 }, jelzoDoboz(fajta), style]}>{children}</View>;
}

export { javasoltCsempe };
