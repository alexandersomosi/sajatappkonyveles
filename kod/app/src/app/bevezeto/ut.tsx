// SPEC §29.10.3 `ut` – "Van már egyéni vállalkozásod?" as its own guided screen; after "Még nincs" the second question
// "Hogyan jelentsük be?" (magam / intézzétek helyettem). The answer is the same PUT as on the checklist (§27.2).
import { useState } from 'react';
import { router } from 'expo-router';
import { fillPlaceholders, START_MODE_TEXTS } from '@/_shared/bekotes';
import type { BusinessStatus } from '@/_shared/enums';
import { GUIDED_TEXTS as G } from '@/_shared/k29g';
import { ApiHiba } from '@/api/http';
import { useOnboarding, useUzletiAllapot } from '@/api/hooks';
import { useGuided } from '@/api/hooks-k29g';
import { hibaUzenet } from '@/lib/hiba';
import { helyettunkUt } from '@/lib/ut';
import { BevezetoSav, ValaszKartya } from '@/kepernyok/Bevezeto';
import { HibaSzoveg, Lap } from '@/ui/alap';
import { Kepernyo } from '@/ui/keret';
import { MiEz } from '@/ui/Magyarazat';
import { useEvSegitseg } from '@/ui/Ut';

export default function BevezetoUt() {
  const o = useOnboarding();
  const g = useGuided();
  const allapot = useUzletiAllapot();
  const evNyitva = useEvSegitseg();
  const [kerdes, setKerdes] = useState<'ut' | 'hogyan'>('ut');
  const [mit, setMit] = useState<string | null>(null);
  const [hiba, setHiba] = useState<string | null>(null);
  const fn = g.data?.welcome.accountant?.firstName ?? o.data?.accountant.firstName ?? 'a könyvelőd';
  const most = o.data?.path ?? null;
  const mod = o.data?.registrationMode ?? null;

  async function valasz(b: BusinessStatus, kesobb: 'tovabb' | 'segitett' = 'tovabb') {
    setHiba(null);
    setMit(kesobb === 'segitett' ? 'segitett' : b);
    try {
      // a same answer is not sent again (it would count as a path change for the staff badge)
      if (most !== b || (b === 'inditas' && mod !== 'onallo' && kesobb === 'tovabb')) await allapot.mutateAsync(b === 'inditas' ? { businessStatus: b, mode: 'onallo' } : { businessStatus: b });
      if (kesobb === 'segitett') {
        const h = helyettunkUt('vallalkozas_bejelentes', 'bevezeto');
        router.push({ pathname: h.pathname, params: { ...h.params, vezetett: 'visszahivas' } });
      } else router.replace('/bevezeto');
    } catch (e) {
      setHiba(e instanceof ApiHiba && e.status === 409 ? e.message : hibaUzenet(e, 'Nem sikerült menteni. Próbáld újra.'));
    } finally {
      setMit(null);
    }
  }

  if (kerdes === 'hogyan') {
    return (
      <Kepernyo fejlec={<BevezetoSav kulcs="ut" vissza={() => setKerdes('ut')} cim={G.utHowTitle} szoveg={START_MODE_TEXTS.sub} />}>
        <Lap style={{ padding: 16, gap: 12 }}>
          <ValaszKartya cim={G.utOnallo} al={G.utOnalloSub} ikon="bevallas" tolt={mit === 'inditas'} tilt={!!mit} kiemelt={most === 'inditas' && mod === 'onallo'} onPress={() => void valasz('inditas')} />
          {evNyitva ? <ValaszKartya cim={G.utSegitett} al={fillPlaceholders(G.utSegitettSub, { firstName: fn })} ikon="igazolas" tolt={mit === 'segitett'} tilt={!!mit} kiemelt={mod === 'segitett'} onPress={() => void valasz('inditas', 'segitett')} /> : null}
          <HibaSzoveg szoveg={hiba} />
        </Lap>
      </Kepernyo>
    );
  }

  return (
    <Kepernyo fejlec={<BevezetoSav kulcs="ut" vissza={() => router.replace('/bevezeto/udv?lap=3')} cim={G.utTitle} szoveg={G.utSub} />}>
      <Lap style={{ padding: 16, gap: 12 }}>
        <ValaszKartya cim={G.utVan} al={G.utVanSub} ikon="irat" tolt={mit === 'van'} tilt={!!mit} kiemelt={most === 'van'} onPress={() => void valasz('van')} />
        <ValaszKartya cim={G.utInditas} al={G.utInditasSub} ikon="tepnaptar" tilt={!!mit} kiemelt={most === 'inditas'} onPress={() => setKerdes('hogyan')} />
        <HibaSzoveg szoveg={hiba} />
        <MiEz kulcs="vallalkozas_van_e" style={{ alignSelf: 'flex-start' }} />
      </Lap>
    </Kepernyo>
  );
}
