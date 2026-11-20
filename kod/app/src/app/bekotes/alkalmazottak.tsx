// SPEC §28.K.7 – „Van alkalmazottad vagy egyszerűsített foglalkoztatottad (EFO)?” (bekötés, „van” út, az Adataid után),
// majd SPEC §28.3.4 (4): egyszer a kedvezmény-kapu („Jár neked adókedvezmény?”). ?csakKapu=1 → csak a kapu.
// Ha van alkalmazott: egyenesen megmondjuk, hogy bérszámfejtést most nem vállalunk, és Bence dönt (egyedi ajánlat vagy nem).
import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { ALLOWANCE_TEXTS, EMPLOYER_ANSWER_LABELS, EMPLOYER_TEXTS, fillPlaceholders } from '@/_shared/bekotes';
import { EMPLOYER_ANSWERS, type EmployerAnswer } from '@/_shared/enums';
import { useAlkalmazottValasz, useKedvezmenyKapu, useOnboarding } from '@/api/hooks';
import { hibaUzenet } from '@/lib/hiba';
import { bekotesre, vezetettHref, vezetettKulcs } from '@/lib/vezetett';
import { maiNap } from '@/lib/format';
import { Kapszulak, UrlapFej, UrlapKerdes } from '@/kepernyok/Urlap';
import { szin } from '@/theme/tokens';
import { GombE, GombM, GombSz, HibaSzoveg } from '@/ui/alap';
import { Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { MiEzKor } from '@/ui/Magyarazat';
import { T } from '@/ui/T';

export default function Alkalmazott() {
  const p = useLocalSearchParams<{ csakKapu?: string }>();
  const o = useOnboarding();
  const fn = o.data?.accountant.firstName ?? 'a könyvelőd';
  const valasz = useAlkalmazottValasz();
  const kapu = useKedvezmenyKapu();
  const jelez = useJelzes();
  const [v, setV] = useState<EmployerAnswer | null>(null);
  const [kapuLap, setKapuLap] = useState(p.csakKapu === '1');
  const [hiba, setHiba] = useState<string | null>(null);
  const ev = Number(maiNap().slice(0, 4));
  const kapuValt = async (gate: 'nem_jar' | 'kesobb') => {
    try {
      await kapu.mutateAsync({ year: ev, gate });
      if (gate === 'nem_jar') jelez({ szoveg: ALLOWANCE_TEXTS.kapu.nemJarToast, kesz: true });
    } catch {
      /* a kapu válasza nem akadályozza a bekötést */
    }
    bekotesre();
  };

  if (kapuLap) {
    return (
      <Kepernyo ful="fooldal" fejlec={<UrlapFej vissza={() => vissza('/bekotes')} szakasz="Adókedvezmények" />} dokk={<GombE cim={ALLOWANCE_TEXTS.kapu.primary} onPress={() => router.replace(vezetettKulcs() ? vezetettHref('/kedvezmenyek/kerdoiv', 'kedvezmenyek') : '/kedvezmenyek/kerdoiv')} />}>
        <UrlapKerdes cim={ALLOWANCE_TEXTS.kapu.title} miert={ALLOWANCE_TEXTS.kapu.body} ikon="igazolas" />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <GombM cim={ALLOWANCE_TEXTS.kapu.nemJar} onPress={() => void kapuValt('nem_jar')} />
          <GombSz cim={ALLOWANCE_TEXTS.kapu.kesobb} m={16} onPress={() => void kapuValt('kesobb')} />
        </View>
      </Kepernyo>
    );
  }
  return (
    <Kepernyo
      ful="fooldal"
      fejlec={<UrlapFej vissza={() => vissza('/bekotes')} szakasz="Vállalkozásod" />}
      dokk={
        <GombE
          cim="Tovább"
          tolt={valasz.isPending}
          onPress={async () => {
            if (!v) return setHiba('Válassz egyet.');
            try {
              await valasz.mutateAsync({ answer: v });
              setHiba(null);
              // SPEC §29.10: in the guided run the allowance gate is its own next step
              if (vezetettKulcs()) return bekotesre();
              setKapuLap(true);
            } catch (e) {
              setHiba(hibaUzenet(e, 'Nem sikerült menteni. Próbáld újra.'));
            }
          }}
        />
      }
    >
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
        <View style={{ flex: 1 }}>
          <UrlapKerdes cim={EMPLOYER_TEXTS.question} ikon="fiok" />
        </View>
        <MiEzKor kulcs="alkalmazott_efo" style={{ marginTop: 8 }} />
      </View>
      <Kapszulak oszlop elemek={EMPLOYER_ANSWERS.map((k) => ({ kulcs: k, cim: EMPLOYER_ANSWER_LABELS[k] }))} ertek={v} valt={setV} />
      {v && v !== 'nincs' ? (
        <View style={{ marginTop: 16, marginHorizontal: -16, paddingHorizontal: 16, paddingTop: 12, borderTopWidth: 10, borderTopColor: szin.sav }}>
          <T m={16} s={600} lh={1.45}>
            {fillPlaceholders(EMPLOYER_TEXTS.yes, { firstName: fn })}
          </T>
          <T m={15} lh={1.45} c={szin.halvany} style={{ marginTop: 6 }}>
            {fillPlaceholders(EMPLOYER_TEXTS.subscriptionLock, { firstName: fn })}
          </T>
        </View>
      ) : null}
      <HibaSzoveg szoveg={hiba} />
    </Kepernyo>
  );
}
