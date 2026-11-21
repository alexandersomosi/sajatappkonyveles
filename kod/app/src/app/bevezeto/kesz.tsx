// SPEC §29.10.3 – the done screen of the guided first run: "Kész vagy a te részeddel!", what others do now (who · what ·
// usual time), "Főoldal" (done_seen → the checklist, which stays the overview; once active: the home screen).
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { fillPlaceholders } from '@/_shared/bekotes';
import { GUIDED_TEXTS as G } from '@/_shared/k29g';
import { useGuided, useGuidedAction } from '@/api/hooks-k29g';
import { BevezetoSav } from '@/kepernyok/Bevezeto';
import { szin } from '@/theme/tokens';
import { GombE, Lap, Szakasz } from '@/ui/alap';
import { KeszJel } from '@/ui/kepek';
import { FelpattanoPipa, Konfetti } from '@/ui/mozgas';
import { Betolt, Hiba, Kepernyo } from '@/ui/keret';
import { T } from '@/ui/T';

export default function BevezetoKesz() {
  const g = useGuided();
  const a = useGuidedAction();
  const [megy, setMegy] = useState(false);
  if (g.isLoading) return <Kepernyo><Betolt /></Kepernyo>;
  if (g.error || !g.data) return <Kepernyo><Hiba hiba={g.error} ujra={() => void g.refetch()} /></Kepernyo>;
  const v = g.data;
  const fn = v.welcome.accountant?.firstName ?? 'A könyvelőd';
  const fooldal = async () => {
    setMegy(true);
    try {
      await a.mutateAsync({ action: 'done_seen' });
    } catch {
      /* a "látta" jel nélkül is mehet tovább */
    }
    router.replace(v.inOnboarding ? '/bekotes' : '/');
  };
  const most = v.pending.filter((p) => !p.later);
  const kesobb = v.pending.filter((p) => p.later);
  // k7c: a client step that only comes later (the bar shows e.g. 7 / 8) – never "Kész vagy a te részeddel!" next to it;
  // the checklist says the same ("Már csak 1 dolog kell tőled")
  const tolemMeg = v.steps.filter((s) => s.state !== 'kihagyva' && !s.doneForClient);
  const cim = tolemMeg.length ? G.doneLaterTitle : G.doneTitle;
  const szoveg = tolemMeg.length
    ? fillPlaceholders(G.doneLaterBody, { n: String(tolemMeg.length), lepesek: tolemMeg.map((s) => s.title).join(', '), firstName: fn })
    : fillPlaceholders(G.doneBody, { firstName: fn });
  return (
    <Kepernyo fejlec={<BevezetoSav kulcs="kesz" vissza={null} kesobb={false} cim={cim} szoveg={szoveg} felett={<View style={{ paddingHorizontal: 18, marginTop: 10 }}><FelpattanoPipa pt={52} label="Kész" /></View>} />} dokk={<GombE cim={G.doneButton} tolt={megy} onPress={() => void fooldal()} />}>
      {/* k8 mozgás #6: a bekötés vége – rövid, egyszeri konfetti */}
      <Konfetti kulcs="bekotes-kesz" />
      {most.length ? (
        <>
          <Szakasz ikon="ora" cim={G.donePendingTitle} />
          <Lap>
            {most.map((p, i) => (
              <Sor key={p.key} cim={p.title} ki={p.actorLabel} ido={p.timeText} elso={i === 0} />
            ))}
          </Lap>
        </>
      ) : null}
      {kesobb.length ? (
        <>
          <Szakasz ikon="tepnaptar" cim="Utána jön" />
          <Lap>
            {kesobb.map((p, i) => (
              <Sor key={p.key} cim={p.title} ki={p.actorLabel} ido={G.doneLater} elso={i === 0} />
            ))}
          </Lap>
        </>
      ) : null}
    </Kepernyo>
  );
}

function Sor({ cim, ki, ido, elso }: { cim: string; ki: string; ido: string | null; elso: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 8, paddingLeft: 54, paddingRight: 16, borderTopWidth: elso ? 0 : 1, borderTopColor: szin.hajszal }}>
      <View style={{ flex: 1 }}>
        <T m={16} s={600} lh={1.35}>
          {cim}
        </T>
        <T m={15} lh={1.4} c={szin.halvany}>
          {[ki, ido].filter(Boolean).join(' · ')}
        </T>
      </View>
    </View>
  );
}
