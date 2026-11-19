// SPEC §28.5.2 – „Változás a vállalkozásodban”: egy szakasz, soronként a változás fajtája (3D ikon, cím, egy mondat);
// felül a folyamatban lévő kérés állapota; alul a többi adat (lakcím, telefon, bankszámla) és a visszahívás.
import { router } from 'expo-router';
import { View } from 'react-native';
import { CHANGE_TEXTS } from '@/_shared/bekotes';
import { useValtozasok } from '@/api/hooks';
import { SavFej } from '@/kepernyok/k28';
import { Lap, Sor, Szakasz } from '@/ui/alap';
import type { Ikon3dNev } from '@/ui/kepek';
import { Betolt, Hiba, Kepernyo, vissza } from '@/ui/keret';
import { MiEzKor } from '@/ui/Magyarazat';
import { Elakadtal } from '@/ui/Visszahivas';

export default function ValtozasHub() {
  const q = useValtozasok();
  const nyitott = q.data?.items.filter((i) => i.openAssist) ?? [];
  return (
    <Kepernyo ful="fiok" fejlec={<SavFej vissza={() => vissza('/fiok')} ikon="irat" cim={CHANGE_TEXTS.hub.title} mondat={CHANGE_TEXTS.hub.sub} />}>
      {q.isLoading ? (
        <Betolt />
      ) : q.error || !q.data ? (
        <Hiba hiba={q.error} ujra={() => void q.refetch()} />
      ) : (
        <>
          {nyitott.length ? (
            <>
              <Szakasz ikon="ora" cim="Folyamatban" />
              <Lap>
                {nyitott.map((i, n) => (
                  <Sor
                    key={i.kind}
                    elso={n === 0}
                    ikon={i.icon as Ikon3dNev}
                    cim={i.title}
                    al={i.openAssist!.statusText}
                    onPress={() => router.push(i.openAssist!.status === 'meghatalmazas_el' ? { pathname: '/valtozas/engedely', params: { assist: i.openAssist!.id } } : `/valtozas/${i.kind}`)}
                  />
                ))}
              </Lap>
            </>
          ) : null}
          <Szakasz ikon="irat" cim="Mi változik?" jobbra={<MiEzKor kulcs="valtozas_hub" />} />
          <Lap>
            {q.data.items.map((i, n) => (
              <Sor key={i.kind} elso={n === 0} ikon={i.icon as Ikon3dNev} cim={i.title} al={i.outdated ? CHANGE_TEXTS.outdated : i.line} onPress={() => router.push(`/valtozas/${i.kind}`)} />
            ))}
            {/* k6c: one text link per screen – "Más változott?" is a row of the list */}
            <Sor ikon="irat" cim="Más változott?" al="Lakcím, telefonszám, bankszámla: írd meg nekünk." onPress={() => router.push({ pathname: '/keresek/uj', params: { tipus: 'adatvaltozas' } })} />
          </Lap>
          <View style={{ paddingTop: 12 }}>
            <Elakadtal forras="valtozas_utmutato" tema="valtozas" cim={CHANGE_TEXTS.hub.help} />
          </View>
        </>
      )}
    </Kepernyo>
  );
}
