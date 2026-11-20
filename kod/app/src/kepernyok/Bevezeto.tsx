// SPEC §29.10.3 – common parts of the guided first run's own screens (W1–W3, the branch question, the adószám, the
// waiting screen, the done screen): the blue band with "Vissza" · "Később folytatom", the progress bar and the title.
import type { ReactNode } from 'react';
import { Image, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { fillPlaceholders } from '@/_shared/bekotes';
import { GUIDED_TEXTS, type GuidedView } from '@/_shared/k29g';
import { useGuidedAction } from '@/api/hooks-k29g';
import { forma, szin } from '@/theme/tokens';
import { Fejlec, GombE, Lap } from '@/ui/alap';
import { Ikon3d, type Ikon3dNev } from '@/ui/kepek';
import { T } from '@/ui/T';
import { Haladas, VezetettFelsoSor, VezetettHaladas } from '@/ui/Vezetett';

const MARKA = require('../../assets/icon.png');

export function BevezetoSav({ kulcs, vissza, cim, szoveg, haladas = true, ikon, felett, kesobb = true }: {
  kulcs: string;
  vissza?: (() => void) | null;
  cim: string;
  szoveg?: string | null;
  haladas?: boolean;
  ikon?: Ikon3dNev;
  /** Something between the progress bar and the title (the brand mark on W1, the page dots). */
  felett?: ReactNode;
  kesobb?: boolean;
}) {
  return (
    <Fejlec rozX={318} rozY={128} alsoTer={22}>
      {kesobb ? <VezetettFelsoSor vissza={vissza} kulcs={kulcs} /> : <View style={{ minHeight: 44 }} />}
      {haladas ? <VezetettHaladas style={{ marginTop: 8, paddingHorizontal: 16 }} /> : null}
      {felett}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, paddingHorizontal: 16 }}>
        {ikon ? <Ikon3d nev={ikon} pt={30} /> : null}
        <T m={26} maxFontSizeMultiplier={1.4} s={700} lh={1.15} ls={-0.022} c="#fff" style={{ flexShrink: 1 }} accessibilityRole="header">
          {cim}
        </T>
      </View>
      {szoveg ? (
        <T m={16} lh={1.45} c={szin.fejlecHalvany} style={{ marginTop: 6, paddingRight: 16, paddingLeft: ikon ? 54 : 16 }}>
          {szoveg}
        </T>
      ) : null}
    </Fejlec>
  );
}

/** The brand mark of W1: the app's own mark (the "A" with the pen stroke) in a white ring. */
export function MarkaJel({ pt = 64 }: { pt?: number }) {
  return (
    <View style={{ width: pt, height: pt, borderRadius: pt / 2, borderWidth: 2, borderColor: 'rgba(255,255,255,0.8)', overflow: 'hidden', marginTop: 8, marginLeft: 16 }} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Image source={MARKA} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
    </View>
  );
}

/** Page dots of the three welcome screens ("1. a 3-ból"). */
export function LapPontok({ lap, db = 3 }: { lap: number; db?: number }) {
  return (
    <View style={{ flexDirection: 'row', gap: 6, marginTop: 10, paddingHorizontal: 16 }} accessibilityLabel={`${lap}. oldal a ${db}-ból`}>
      {Array.from({ length: db }, (_, i) => (
        <View key={i} style={{ width: i + 1 === lap ? 22 : 8, height: 8, borderRadius: 4, backgroundColor: i + 1 === lap ? '#fff' : 'rgba(255,255,255,0.35)' }} />
      ))}
    </View>
  );
}

/**
 * SPEC §29.10.1 – on the checklist after "Később folytatom": "Folytasd ott, ahol abbahagytad" / "Következő: {lépés} ·
 * {idő}" / "Folytatom" (resume → /bevezeto at the right step).
 * k7c: a client who never started the guided run (welcome not seen, not paused) gets the start card instead ("Kezdjük"
 * → /bevezeto → W1); before the branch answer ('nincs') there is no bar ("0 / 1" would mislead).
 */
export function FolytasKartya({ v, elso }: { v: GuidedView; elso?: boolean }) {
  const a = useGuidedAction();
  const s = v.currentKey ? v.steps.find((x) => x.key === v.currentKey) : null;
  const kezdo = !v.paused && !v.welcome.seen;
  const folytat = async () => {
    if (kezdo) return void router.replace('/bevezeto');
    try {
      await a.mutateAsync({ action: 'resume' });
    } catch {
      /* a folytatás jel nélkül is nyílik */
    }
    router.replace('/bevezeto');
  };
  return (
    <Lap elso={elso} style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 32 }}>
        <Ikon3d nev="tepnaptar" pt={28} />
        <T m={18} s={650} lh={1.3} style={{ flex: 1 }} accessibilityRole="header">
          {kezdo ? GUIDED_TEXTS.startTitle : GUIDED_TEXTS.pausedTitle}
        </T>
      </View>
      <View style={{ paddingLeft: 38 }}>
        {kezdo ? (
          <T m={16} lh={1.45} style={{ marginTop: 4 }}>
            {GUIDED_TEXTS.startBody}
          </T>
        ) : s ? (
          <T m={16} lh={1.45} style={{ marginTop: 4 }}>
            {s.timeText ? fillPlaceholders(GUIDED_TEXTS.pausedNext, { lepes: s.title, ido: s.timeText }) : fillPlaceholders(GUIDED_TEXTS.pausedNextNoTime, { lepes: s.title })}
          </T>
        ) : null}
        {!kezdo && v.variant !== 'nincs' ? <Haladas done={v.progress.done} total={v.progress.total} sotet style={{ marginTop: 10 }} /> : null}
        <GombE cim={kezdo ? GUIDED_TEXTS.startButton : GUIDED_TEXTS.pausedButton} tolt={a.isPending} onPress={() => void folytat()} style={{ marginTop: 14 }} />
      </View>
    </Lap>
  );
}
FolytasKartya.szakaszos = true;

/** A big answer card (the branch question): 3D object, title, one line. */
export function ValaszKartya({ cim, al, ikon, onPress, tolt, kiemelt, tilt }: { cim: string; al: string; ikon: Ikon3dNev; onPress: () => void; tolt?: boolean; kiemelt?: boolean; tilt?: boolean }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${cim}. ${al}`}
      disabled={tilt}
      onPress={onPress}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        minHeight: 76,
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: forma.mezo,
        borderWidth: kiemelt ? 2 : 1.5,
        borderColor: pressed || kiemelt ? szin.tintakek : szin.keret,
        backgroundColor: pressed ? '#F6F8FB' : szin.mezoAlap,
        opacity: tilt && !tolt ? 0.5 : 1,
      })}
    >
      <Ikon3d nev={ikon} pt={44} />
      <View style={{ flex: 1 }}>
        <T m={18} s={700} lh={1.3}>
          {cim}
        </T>
        <T m={15} lh={1.4} c={szin.halvany}>
          {tolt ? 'Mentjük…' : al}
        </T>
      </View>
    </Pressable>
  );
}
