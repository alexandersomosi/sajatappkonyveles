// A belépési folyamat lapjai – v2 (k8; minta: dizajn/C5_v2/10–15, asztali/A10). Telefonon a kék fejléc (logó, DEMO,
// cím) és alatta fehér kártyák a szürke háttéren. Gépen (≥ 1024 pt, web) osztott oldal: balra a kék márka-fél (logó,
// „A saját könyvelőd, a zsebedben.”, három előny fehér csempében), jobbra az űrlap legfeljebb 460 pt szélesen.
// A régi változat: _regi/elotte_k8_A/src/kepernyok/AuthKeret.tsx.
import type { ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { Ikon, Logo, fejGradiens, type EmojiNev } from '../_shared/v2/rn';
import { useAsztali } from '../lib/elrendezes';
import { forma, szin } from '../theme/tokens';
import { Fejlec, TeljesGombCtx } from '../ui/alap';
import { DemoPirula } from '../ui/demoAllapot';
import { vissza } from '../ui/keret';
import { TeljesCtx } from '../ui/teljes';
import { T } from '../ui/T';

/** A márka-fél előnyei (A10). Nincs bennük időígéret és kitalált szám. */
const ELONYOK: { ikon: EmojiNev; szoveg: string }[] = [
  { ikon: 'tarca', szoveg: 'Látod, mennyit tegyél félre az adóra.' },
  { ikon: 'dosszie', szoveg: 'A számláid egy helyen vannak, a könyvelőd is látja őket.' },
  { ikon: 'naptar', szoveg: 'A határidőkre időben figyelmeztetünk.' },
];

/** „A saját könyvelőd, / a zsebedben.” – a második sor sárgán (v2 10_belepes). */
export function Szlogen({ m = 30 }: { m?: number }) {
  return (
    <T m={m} s={800} lh={1.14} ls={-0.025} c="#fff" accessibilityRole="header">
      A saját könyvelőd,{'\n'}
      <T m={m} s={800} c={szin.sarga}>
        a zsebedben.
      </T>
    </T>
  );
}

/** Gépen: a bal, kék márka-fél (díszítés nélküli szöveg + a három előny). */
function MarkaFel() {
  return (
    <View style={{ flex: 1, overflow: 'hidden', justifyContent: 'center', paddingHorizontal: 72, paddingVertical: 48 }}>
      <Svg width="100%" height="100%" preserveAspectRatio="none" style={StyleSheet.absoluteFill}>
        <Defs>
          <LinearGradient id="markafel" x1="0.2" y1="0" x2="0.8" y2="1">
            {fejGradiens.szinek.map((c, i) => (
              <Stop key={c} offset={fejGradiens.helyek[i]} stopColor={c} />
            ))}
          </LinearGradient>
        </Defs>
        <Rect x={0} y={0} width="100%" height="100%" fill="url(#markafel)" />
      </Svg>
      <View pointerEvents="none" style={{ position: 'absolute', width: 520, height: 520, left: -170, bottom: -230, borderRadius: 260, borderWidth: 46, borderColor: 'rgba(255,255,255,0.05)' }} />
      <View style={{ maxWidth: 520 }}>
        <Logo meret={44} feher />
        <View style={{ marginTop: 40 }}>
          <Szlogen m={44} />
        </View>
        <View style={{ marginTop: 36, gap: 16 }}>
          {ELONYOK.map((e) => (
            <View key={e.ikon} style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
              <View style={{ width: 52, height: 52, borderRadius: 14, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
                <Ikon nev={e.ikon} pt={36} />
              </View>
              <T m={17} lh={1.45} c="#fff" style={{ flex: 1 }}>
                {e.szoveg}
              </T>
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

/**
 * Az auth-lapok váza. `fej`: a telefonos kék fejléc tartalma (a Fejlec-en belül). Gépen a fej helyett a márka-fél áll,
 * az űrlap-oszlop tetején a `gepCim` (és `gepAl`), alatta a kártyák.
 */
export function AuthVaz({ fej, gepCim, gepAl, gepFelso, vissza: visszaGomb, children }: { fej: ReactNode; gepCim?: string; gepAl?: string; gepFelso?: ReactNode; vissza?: { cim: string; onPress: () => void } | null; children: ReactNode }) {
  const asztali = useAsztali();
  if (asztali) {
    return (
      <View style={{ flex: 1, flexDirection: 'row', backgroundColor: szin.alap }}>
        <MarkaFel />
        <View style={{ flex: 1 }}>
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 40, paddingVertical: 64 }}>
            <View style={{ width: '100%', maxWidth: 460 }}>
              {visszaGomb ? (
                <T m={15.5} s={650} c={szin.tintakekSzoveg} alahuz accessibilityRole="link" onPress={visszaGomb.onPress} style={{ marginBottom: 14, alignSelf: 'flex-start', paddingVertical: 8 }}>
                  {visszaGomb.cim}
                </T>
              ) : null}
              {gepFelso}
              {gepCim ? (
                <View style={{ marginBottom: 16, paddingHorizontal: 4 }}>
                  <T m={26} s={800} lh={1.2} ls={-0.02} accessibilityRole="header">
                    {gepCim}
                  </T>
                  {gepAl ? (
                    <T m={15.5} lh={1.45} c={szin.halvany} style={{ marginTop: 6 }}>
                      {gepAl}
                    </T>
                  ) : null}
                </View>
              ) : null}
              <TeljesCtx.Provider value>
                <TeljesGombCtx.Provider value>{children}</TeljesGombCtx.Provider>
              </TeljesCtx.Provider>
            </View>
          </ScrollView>
          <View pointerEvents="none" style={{ position: 'absolute', top: 24, right: 28 }}>
            <DemoPirula kicsi />
          </View>
        </View>
      </View>
    );
  }
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: szin.alap }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingBottom: 48, flexGrow: 1 }}>
        <Fejlec alsoTer={24} vissza={visszaGomb ?? null}>
          {fej}
        </Fejlec>
        <TeljesCtx.Provider value>
          <View style={{ paddingHorizontal: forma.margo, paddingTop: 14, flex: 1 }}>{children}</View>
        </TeljesCtx.Provider>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

export function AuthKeret({ cim, al, children, visszaCim = 'Vissza a belépéshez', visszaHova = '/belepes', felso }: { cim: string; al?: string; children: ReactNode; visszaCim?: string | null; visszaHova?: string; felso?: ReactNode }) {
  const asztali = useAsztali();
  return (
    <AuthVaz
      vissza={visszaCim ? { cim: visszaCim, onPress: () => vissza(visszaHova) } : null}
      gepCim={cim}
      gepAl={al}
      gepFelso={felso}
      fej={
        <View style={{ paddingHorizontal: asztali ? 16 : 18 }}>
          {felso}
          <T m={25} s={800} lh={1.14} ls={-0.025} c="#fff" style={{ paddingTop: 12 }} accessibilityRole="header">
            {cim}
          </T>
          {al ? (
            <T m={15} lh={1.45} c={szin.fejlecHalvany} style={{ paddingTop: 6, maxWidth: 380 }}>
              {al}
            </T>
          ) : null}
        </View>
      }
    >
      {children}
    </AuthVaz>
  );
}
