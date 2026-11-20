// SPEC §29.10.3 – the guided header parts. Inside the blue band: the "Vissza" capsule, the "Később folytatom" text
// button and ONE continuous 6 pt progress bar "{done} / {total} lépés kész" (§28.K.10, C_VEGLEGES). The existing step
// screens get them through CimSor / UrlapFej / SavCim when their route carries `vezetett`.
import { useEffect, useState, type ReactNode } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { fillPlaceholders } from '../_shared/bekotes';
import { GUIDED_TEXTS } from '../_shared/k29g';
import { useGuided, useGuidedAction } from '../api/hooks-k29g';
import { hibaUzenet } from '../lib/hiba';
import { forma, szin } from '../theme/tokens';
import { T } from './T';

/** The guided step of the current route (`?vezetett=<key>`), or null. */
export function useVezetettParam(): string | null {
  const p = useLocalSearchParams<{ vezetett?: string }>();
  const v = Array.isArray(p.vezetett) ? p.vezetett[0] : p.vezetett;
  return v ? String(v) : null;
}

/** "Később folytatom": saves where the client stopped and opens the checklist (it stays the overview). */
export function useKesobb(kulcs: string | null) {
  const a = useGuidedAction();
  const [hiba, setHiba] = useState<string | null>(null);
  const kesobb = async () => {
    setHiba(null);
    try {
      await a.mutateAsync({ action: 'later', ...(kulcs && kulcs !== 'udv' ? { key: kulcs as never } : {}) });
    } catch (e) {
      // a pause that could not be saved still lets the client leave; the server asks again next time
      setHiba(hibaUzenet(e, ''));
    }
    router.replace('/bekotes');
  };
  return { kesobb, tolt: a.isPending, hiba };
}

/** The "Vissza" capsule of the band (white outline). */
export function SavVissza({ onPress, cim = GUIDED_TEXTS.back, label }: { onPress: () => void; cim?: string; label?: string }) {
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label ?? cim}
      onPress={onPress}
      hitSlop={4}
      style={({ pressed }) => [{ height: 36, paddingHorizontal: 14, borderRadius: forma.gomb, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.8)', justifyContent: 'center', zIndex: 1 }, pressed && { backgroundColor: 'rgba(255,255,255,0.1)' }]}
    >
      <T m={15.5} s={650} c="#fff" numberOfLines={1}>
        {cim}
      </T>
    </Pressable>
  );
}

/** "Később folytatom" on the blue band: white, underlined text button. */
export function KesobbGomb({ kulcs }: { kulcs: string | null }) {
  const k = useKesobb(kulcs);
  return (
    <Pressable accessibilityRole="button" onPress={() => void k.kesobb()} disabled={k.tolt} hitSlop={8} style={({ pressed }) => [{ minHeight: 44, justifyContent: 'center', paddingLeft: 8 }, (pressed || k.tolt) && { opacity: 0.6 }]}>
      <T m={15.5} s={550} c="#fff" alahuz numberOfLines={1}>
        {GUIDED_TEXTS.later}
      </T>
    </Pressable>
  );
}

/** The ONE continuous bar with the number (Shopify setup guide, C_VEGLEGES `.halad`). */
export function Haladas({ done, total, style, sotet }: { done: number; total: number; style?: object; /** on a white section (the paused card) */ sotet?: boolean }) {
  const arany = total > 0 ? Math.min(1, Math.max(0, done / total)) : 0;
  const [, , szoveg] = fillPlaceholders(GUIDED_TEXTS.progress, { done: String(done), total: String(total) }).match(/^(\S+ \/ \S+)\s(.*)$/) ?? [];
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 28 }, style]} accessible accessibilityRole="progressbar" accessibilityLabel={fillPlaceholders(GUIDED_TEXTS.progress, { done: String(done), total: String(total) })} accessibilityValue={{ min: 0, max: total, now: done }}>
      <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
        <T m={18} s={750} lh={1.1} ls={-0.01} c={sotet ? szin.tinta : '#fff'} szam>
          {`${done} / ${total}`}
        </T>
        <T m={15} lh={1.1} c={sotet ? szin.halvany : szin.fejlecHalvany} numberOfLines={1}>
          {szoveg ?? 'lépés kész'}
        </T>
      </View>
      <View style={{ flex: 1, height: 6, borderRadius: 3, backgroundColor: sotet ? szin.sav : 'rgba(255,255,255,0.26)', overflow: 'hidden' }}>
        <View style={{ width: `${arany * 100}%`, height: '100%', borderRadius: 3, backgroundColor: sotet ? szin.tintakek : '#fff' }} />
      </View>
    </View>
  );
}

/**
 * The guided strip under the band's top row: the progress of the server's GuidedView. The bar never goes backwards
 * while the client edits an earlier step (it shows the highest value seen on this phone in this session).
 */
let legtobb = 0;
export function VezetettHaladas({ style }: { style?: object }) {
  const g = useGuided();
  const d = g.data?.progress;
  const [kesz, setKesz] = useState(() => Math.max(legtobb, d?.done ?? 0));
  useEffect(() => {
    if (!d) return;
    legtobb = Math.min(d.total, Math.max(legtobb, d.done));
    setKesz(legtobb);
  }, [d]);
  if (!d) return <View style={[{ minHeight: 28 }, style]} />;
  // before the branch answer the run has no length yet ("0 / 1" would mislead)
  if (g.data?.variant === 'nincs') return null;
  return <Haladas done={kesz} total={d.total} style={style} />;
}

/** The top row of a guided band: Vissza (left) · Később folytatom (right). Native: below the DEMO/MINTA chip. */
export function VezetettFelsoSor({ vissza, kulcs, kozep }: { vissza?: (() => void) | null; kulcs: string | null; kozep?: ReactNode }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: 16, marginTop: Platform.OS === 'web' ? 6 : 14 }}>
      {vissza ? <SavVissza onPress={vissza} /> : null}
      <View style={{ flex: 1, minWidth: 0, paddingHorizontal: 8 }}>{kozep}</View>
      <KesobbGomb kulcs={kulcs} />
    </View>
  );
}
