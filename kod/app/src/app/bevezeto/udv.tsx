// SPEC §29.10.3 W1–W3 – the three welcome screens of the guided first run (who we are, your accountant, how it goes and
// what it costs). "Kezdjük" marks them seen (welcome_seen) and the run goes on with the branch question.
import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { fillPlaceholders } from '@/_shared/bekotes';
import { GUIDED_TEXTS as G } from '@/_shared/k29g';
import { useGuided, useGuidedAction } from '@/api/hooks-k29g';
import { szam } from '@/lib/format';
import { hibaUzenet } from '@/lib/hiba';
import { BevezetoSav, LapPontok, MarkaJel } from '@/kepernyok/Bevezeto';
import { szin } from '@/theme/tokens';
import { GombE, GombSz, HibaSzoveg, Lap, Szakasz } from '@/ui/alap';
import { Arckep, Ikon3d, type Ikon3dNev } from '@/ui/kepek';
import { Betolt, Hiba, Kepernyo } from '@/ui/keret';
import { T } from '@/ui/T';
import { useKesobb } from '@/ui/Vezetett';

/** W1: what the service does, in three plain rows (the 3D objects of the approved set). */
const W1_SOROK: { cim: string; ikon: Ikon3dNev }[] = [
  { cim: 'A kiállított számláid maguktól bejönnek a NAV-ból', ikon: 'szamlak' },
  { cim: 'Megmondjuk, mennyit tegyél félre az adóra', ikon: 'szamolo' },
  { cim: 'A könyvelődnek az appban írsz', ikon: 'uzenetek' },
];

export default function Udv() {
  const p = useLocalSearchParams<{ lap?: string }>();
  const g = useGuided();
  const a = useGuidedAction();
  const later = useKesobb('udv');
  const [hiba, setHiba] = useState<string | null>(null);
  const lap = Math.min(3, Math.max(1, Number(p.lap) || 1));
  const ugrik = (n: number) => router.setParams({ lap: String(n) });
  if (g.isLoading) return <Kepernyo><Betolt /></Kepernyo>;
  if (g.error || !g.data) return <Kepernyo><Hiba hiba={g.error} ujra={() => void g.refetch()} /></Kepernyo>;
  const v = g.data;
  const acc = v.welcome.accountant;
  const fn = acc?.firstName ?? 'A könyvelőd';

  const kezdjuk = async () => {
    setHiba(null);
    try {
      await a.mutateAsync({ action: 'welcome_seen' });
      router.replace('/bevezeto');
    } catch (e) {
      setHiba(hibaUzenet(e, 'Nem sikerült. Próbáld újra.'));
    }
  };

  if (lap === 1) {
    return (
      <Kepernyo
        fejlec={<BevezetoSav kulcs="udv" haladas={false} cim={fillPlaceholders(G.w1Title, { keresztnev: v.firstName })} felett={<><MarkaJel /><LapPontok lap={1} /></>} />}
        dokk={<GombE cim={G.next} onPress={() => ugrik(2)} />}
      >
        <Lap style={{ padding: 16 }}>
          <T m={17} lh={1.5}>
            {G.w1Body}
          </T>
        </Lap>
        <Lap style={{ paddingVertical: 6 }}>
          {W1_SOROK.map((s, i) => (
            <View key={s.cim} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8, paddingHorizontal: 16, borderTopWidth: i ? 1 : 0, borderTopColor: szin.hajszal }}>
              <Ikon3d nev={s.ikon} pt={28} />
              <T m={16} s={600} lh={1.35} style={{ flex: 1 }}>
                {s.cim}
              </T>
            </View>
          ))}
        </Lap>
      </Kepernyo>
    );
  }

  if (lap === 2) {
    return (
      <Kepernyo fejlec={<BevezetoSav kulcs="udv" haladas={false} vissza={() => ugrik(1)} cim={acc ? G.w2Title : G.w2NoneTitle} felett={<LapPontok lap={2} />} />} dokk={<GombE cim={G.next} onPress={() => ugrik(3)} />}>
        <Lap style={{ padding: 16 }}>
          {acc ? (
            <>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
                <Arckep pt={72} gyuru />
                <View style={{ flex: 1 }}>
                  <T m={19} s={700} lh={1.3}>
                    {acc.displayName}
                  </T>
                  <T m={15} lh={1.4} c={szin.halvany} style={{ marginTop: 2 }}>
                    {fillPlaceholders(G.w2Line, { titulus: acc.title, szam: acc.registrationNumber })}
                  </T>
                </View>
              </View>
              <T m={17} lh={1.5} style={{ marginTop: 14 }}>
                {G.w2Body}
              </T>
            </>
          ) : (
            <T m={17} lh={1.5}>
              {G.w2NoneBody}
            </T>
          )}
        </Lap>
      </Kepernyo>
    );
  }

  return (
    <Kepernyo fejlec={<BevezetoSav kulcs="udv" haladas={false} vissza={() => ugrik(2)} cim={G.w3Title} felett={<LapPontok lap={3} />} />} dokk={<GombE cim={G.w3Start} tolt={a.isPending} onPress={() => void kezdjuk()} />}>
      <Lap style={{ paddingVertical: 6 }}>
        {v.welcome.rows.map((r, i) => (
          <View key={r.title} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56, paddingVertical: 8, paddingHorizontal: 16, borderTopWidth: i ? 1 : 0, borderTopColor: szin.hajszal }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: szin.gombMAlap, alignItems: 'center', justifyContent: 'center' }}>
              <T m={14} s={750} c={szin.tintakekSzoveg} lh={1} szam>
                {i + 1}
              </T>
            </View>
            <View style={{ flex: 1 }}>
              <T m={16} s={600} lh={1.35}>
                {r.title}
              </T>
              <T m={15} lh={1.4} c={szin.halvany}>
                {r.time}
              </T>
            </View>
          </View>
        ))}
      </Lap>
      <Szakasz ikon="szamolo" cim={G.w3PriceTitle} />
      <Lap style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        <View style={{ paddingLeft: 38 }}>
          <T m={28} s={750} lh={1.2} ls={-0.02} szam>
            {fillPlaceholders(G.w3Price, { osszeg: szam(v.welcome.priceHuf) })}
          </T>
          <T m={16} lh={1.45} c={szin.tinta} style={{ marginTop: 4 }}>
            {G.w3PriceBody}
          </T>
          <HibaSzoveg szoveg={hiba} />
          <GombSz cim={G.later} m={16} onPress={() => void later.kesobb()} style={{ marginTop: 6 }} />
        </View>
      </Lap>
    </Kepernyo>
  );
}
