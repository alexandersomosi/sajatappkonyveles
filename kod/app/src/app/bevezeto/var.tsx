// SPEC §29.10.3 – the waiting interstitial: shown once right after the client finished a step that hands over to someone
// else (the meghatalmazás was sent, the papers were uploaded…): who works now, how long it usually takes, and the next
// thing the client can already do ("Tovább: {lépés}") – a waiting step never blocks the rest.
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { fillPlaceholders } from '@/_shared/bekotes';
import { GUIDED_TEXTS as G } from '@/_shared/k29g';
import { useGuided } from '@/api/hooks-k29g';
import { kovetkezoLepes, lepesCel } from '@/lib/bevezeto';
import { BevezetoSav } from '@/kepernyok/Bevezeto';
import { szin } from '@/theme/tokens';
import { GombE, Lap } from '@/ui/alap';
import { Ikon3d } from '@/ui/kepek';
import { Betolt, Hiba, Kepernyo } from '@/ui/keret';
import { T } from '@/ui/T';

export default function BevezetoVar() {
  const p = useLocalSearchParams<{ lepes?: string }>();
  const g = useGuided();
  if (g.isLoading) return <Kepernyo><Betolt /></Kepernyo>;
  if (g.error || !g.data) return <Kepernyo><Hiba hiba={g.error} ujra={() => void g.refetch()} /></Kepernyo>;
  const v = g.data;
  const fn = v.welcome.accountant?.firstName ?? 'A könyvelőd';
  const s = v.steps.find((x) => x.key === p.lepes) ?? null;
  const pend = v.pending.find((x) => x.key === p.lepes) ?? null;
  // the journey has ONE waiting card (the first wait); it belongs to this step only when its title is the step's wait
  // (k7 integrator: after the ID upload the screen showed the callback card of the meghatalmazás)
  const w = s && (s.waitText || pend) && v.waiting?.title !== s.waitText ? null : v.waiting;
  const szereplo = pend?.actorLabel ?? s?.actorLabel;
  const ki = w ? (w.actor === 'nav' ? 'a NAV' : w.actor === 'csapat' ? 'csapatunk' : fn) : szereplo === 'NAV' ? 'a NAV' : szereplo === 'Csapatunk' ? 'csapatunk' : (szereplo ?? fn);
  const ido = w ? w.timeText : (pend?.timeText ?? s?.timeText);
  const kov = kovetkezoLepes(v);
  const cel = kov ? lepesCel(kov) : null;
  return (
    <Kepernyo
      fejlec={<BevezetoSav kulcs={p.lepes ?? 'var'} vissza={null} ikon="ora" cim={fillPlaceholders(G.varTitle, { ki })} />}
      dokk={<GombE cim={kov ? fillPlaceholders(G.varNext, { lepes: kov.title }) : G.varDone} onPress={() => router.replace((cel ?? '/bevezeto/kesz') as never)} />}
    >
      <Lap style={{ padding: 16 }}>
        <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', minHeight: 32 }}>
          <Ikon3d nev="ora" pt={28} />
          <T m={18} s={650} lh={1.3} style={{ flex: 1 }} accessibilityRole="header">
            {w?.title ?? s?.waitText ?? s?.title ?? ''}
          </T>
        </View>
        <View style={{ paddingLeft: 54 }}>
          {w?.body ? (
            <T m={16} lh={1.45} style={{ marginTop: 4 }}>
              {w.body}
            </T>
          ) : null}
          {/* the waiting card's own time (the step's "kb. 5 perc" is the client's part, not the wait) */}
          {ido ? (
            <T m={15} lh={1.4} c={szin.halvany} style={{ marginTop: 6 }}>
              {ido}
            </T>
          ) : null}
          {kov ? (
            <T m={16} s={600} lh={1.45} style={{ marginTop: 12 }}>
              {G.varMeanwhile}
            </T>
          ) : null}
        </View>
      </Lap>
    </Kepernyo>
  );
}
