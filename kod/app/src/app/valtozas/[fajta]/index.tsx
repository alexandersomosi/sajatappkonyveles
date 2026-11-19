// SPEC §28.5.2 – egy változás info-lapja: „Mit jelent?” (a sávban), a kiemelt „Bejelentjük helyetted” kártya a díjjal
// (SPEC §28.K.1, előre fizetve; DEMO jellel, amíg a tulaj nem véglegesítette), „Magam jelentem be (ingyenes)” → az
// útmutató, „Mire figyelj?”, és a visszahívás. A kiemelt kártya 390×844-en görgetés nélkül látszik.
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { CHANGE_FACTS, CHANGE_TEXTS, FEE_TEXTS, fillPlaceholders } from '@/_shared/bekotes';
import { CHANGE_KIND_ICON, changeFeeKind, FEE_DEFAULTS, type ChangeKind } from '@/_shared/enums';
import { useMe, useValtozasok } from '@/api/hooks';
import { szam } from '@/lib/format';
import { valtozasFajta } from '@/lib/utmutato';
import { BELJEBB, DemoDij, SavFej } from '@/kepernyok/k28';
import { forma, szin } from '@/theme/tokens';
import { GombE, GombM, Lap, Szakasz } from '@/ui/alap';
import { Ikon3d, type Ikon3dNev } from '@/ui/kepek';
import { Kepernyo, vissza } from '@/ui/keret';
import { T } from '@/ui/T';
import { Elakadtal } from '@/ui/Visszahivas';

export default function ValtozasInfo() {
  const { fajta } = useLocalSearchParams<{ fajta: string }>();
  const me = useMe();
  const fn = me.data?.accountant?.firstName ?? 'a könyvelőd';
  const v = useValtozasok();
  if (!valtozasFajta(fajta)) {
    return (
      <Kepernyo ful="fiok">
        <T m={16}>Nincs ilyen változás.</T>
      </Kepernyo>
    );
  }
  const kind = fajta as ChangeKind;
  const info = CHANGE_TEXTS.info[kind];
  const sor = CHANGE_TEXTS.sorok[kind];
  const elem = v.data?.items.find((i) => i.kind === kind);
  const nyitott = elem?.openAssist ?? null;
  const fk = changeFeeKind(kind, kind === 'valtozas_adoadat' ? ['munkavegzes'] : []);
  const dij = fk ? FEE_DEFAULTS[fk] : null;
  const sz = (s: string) => fillPlaceholders(s, { firstName: fn });
  // [ELLENŐRIZENDŐ] mondat csak akkor, ha a tény igazolt (SPEC §28.5.1)
  const ellenorzott = CHANGE_FACTS.find((f) => f.key === 'szunetel_hossz')?.verified;
  const figyelj = [...info.figyelj, ...(ellenorzott ? (info.figyeljEllenorizendo ?? []) : [])];
  return (
    <Kepernyo ful="fiok" fejlec={<SavFej vissza={() => vissza('/valtozas')} ikon={CHANGE_KIND_ICON[kind] as Ikon3dNev} cim={sor.title} mondat={sz(info.mit)} />}>
      {elem?.outdated ? (
        <Lap style={{ padding: 16 }}>
          <T m={16} s={600} lh={1.45} c={szin.borostyanSzoveg}>
            {CHANGE_TEXTS.outdated}
          </T>
        </Lap>
      ) : nyitott ? (
        <>
          <Szakasz ikon="ora" cim="Folyamatban" />
          <Lap style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
            <View style={{ paddingLeft: BELJEBB, gap: 10 }}>
              <T m={16} lh={1.45}>
                {nyitott.statusText}
              </T>
              {nyitott.status === 'meghatalmazas_el' ? <GombM cim="Átnézem és engedélyezem" onPress={() => router.push({ pathname: '/valtozas/engedely', params: { assist: nyitott.id } })} /> : null}
              {nyitott.status === 'dijra_var' && nyitott.feeCharge ? <GombM cim={fillPlaceholders(FEE_TEXTS.payButtonAmount, { dij: szam(nyitott.feeCharge.amountHuf) })} onPress={() => router.push('/fiok/dijak')} /> : null}
            </View>
          </Lap>
        </>
      ) : (
        // a kiemelt „Intézzük helyetted” kártya (§27.3.1 minta: 2 pt-os kék keret, kapszula-jelvény, 3D ikon; árnyék nincs)
        <View style={{ paddingTop: 4 }}>
          <View style={{ borderRadius: forma.lap, borderWidth: 2, borderColor: szin.tintakek, padding: 16 }}>
            <View style={{ alignSelf: 'flex-start', height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: szin.gombMAlap, justifyContent: 'center' }}>
              <T m={13.5} s={700} c={szin.tintakekSzoveg}>
                {kind === 'valtozas_adoadat' ? CHANGE_TEXTS.helyettunk.badgeAdoadat : CHANGE_TEXTS.helyettunk.badge}
              </T>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 10 }}>
              <Ikon3d nev="bevallas" pt={30} />
              <T m={18} s={650} lh={1.3} style={{ flex: 1 }}>
                {CHANGE_TEXTS.helyettunk.title}
              </T>
            </View>
            <T m={16} lh={1.45} style={{ marginTop: 6 }}>
              {sz(CHANGE_TEXTS.helyettunk.body)}
            </T>
            {dij ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 6 }}>
                <T m={15} s={600} lh={1.4} szam>
                  {`Díja: ${szam(dij.amountHuf)} Ft, előre fizetve.`}
                </T>
                {!dij.confirmed ? <DemoDij /> : null}
              </View>
            ) : null}
            <GombE cim={CHANGE_TEXTS.helyettunk.button} onPress={() => router.push(`/valtozas/${kind}/kerem`)} style={{ marginTop: 12 }} />
          </View>
          <GombM cim={CHANGE_TEXTS.selfFree} onPress={() => router.push(`/valtozas/${kind}/utmutato`)} style={{ marginTop: 12, marginBottom: 16 }} />
        </View>
      )}
      <Szakasz ikon="lakat" cim="Mire figyelj?" />
      <Lap style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
        {figyelj.map((f, i) => (
          <T key={i} m={16} lh={1.45} style={{ paddingLeft: BELJEBB, marginTop: i ? 6 : 0 }}>
            {`• ${sz(f)}`}
          </T>
        ))}
        <T m={15} lh={1.4} c={szin.halvany} style={{ paddingLeft: BELJEBB, marginTop: 8 }}>
          {FEE_TEXTS.selfFree}
        </T>
      </Lap>
      <View style={{ paddingTop: 8 }}>
        <Elakadtal forras="valtozas_utmutato" tema="valtozas" cim={CHANGE_TEXTS.hub.help} />
      </View>
    </Kepernyo>
  );
}
