// SPEC §29.7 F3 – „A vállalkozás megszüntetése” (változás-fajta 'valtozas_megszuntetes'): az info-lap a választással
// (kiemelt „Megszüntetjük helyetted”, „Magam jelentem be” = útmutató, „Előbb beszéljük meg” = visszahívás), és a kérés
// űrlapja (melyik nappal, volt-e alkalmazott, mi lesz az előfizetéssel, összegzés a díjjal). A [fajta] képernyők hívják.
import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CLOSING_KIND, CLOSING_RULES, CLOSING_TEXTS } from '@/_shared/k29f';
import { CHANGE_TEXTS, FEE_TEXTS, fillPlaceholders } from '@/_shared/bekotes';
import { FEE_DEFAULTS } from '@/_shared/enums';
import type { ChangeData } from '@/_shared/api';
import { useMe, useValtozasKer, useValtozasok } from '@/api/hooks';
import { datumBe, datumEvvel, maiNap, napHozzaad, szam } from '@/lib/format';
import { hibaUzenet } from '@/lib/hiba';
import { BELJEBB, SavFej } from '@/kepernyok/k28';
import { IgenNem, UrlapFej, UrlapKerdes } from '@/kepernyok/Urlap';
import { forma, szin } from '@/theme/tokens';
import { GombE, GombM, HibaSzoveg, Lap, Szakasz } from '@/ui/alap';
import { IgyMegy, SohaBelepes } from '@/ui/Helyettunk';
import { Ikon3d } from '@/ui/kepek';
import { Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { Mezo } from '@/ui/Mezo';
import { T } from '@/ui/T';
import { Elakadtal, visszahivasUt } from '@/ui/Visszahivas';
import { ZaroltSor } from '@/ui/ZarolasKapu';
import { useServiceLock } from '@/ui/Zarolas';

/** „Megszüntetjük helyetted” díja (fee kind 'megszuntetes', alapból a jogállás-változás ára). */
const DIJ = () => FEE_DEFAULTS.megszuntetes;

export function MegszuntetesInfo() {
  const me = useMe();
  const fn = me.data?.accountant?.firstName ?? 'a könyvelőd';
  const v = useValtozasok();
  const { lock } = useServiceLock();
  const elem = v.data?.items.find((i) => i.kind === CLOSING_KIND);
  const nyitott = elem?.openAssist ?? null;
  const dij = DIJ();
  const sz = (s: string) => fillPlaceholders(s, { firstName: fn, dij: szam(dij.amountHuf), evesDij: szam(FEE_DEFAULTS.eves_zaras.amountHuf) });
  return (
    <Kepernyo ful="fiok" fejlec={<SavFej vissza={() => vissza('/valtozas')} ikon="irat" cim={CLOSING_TEXTS.hubRow.title} mondat={sz(CLOSING_TEXTS.info.mit)} />}>
      {elem?.outdated ? (
        <Lap style={{ padding: 16 }}>
          <T m={16} s={600} lh={1.45} c={szin.borostyanSzoveg}>
            {CLOSING_TEXTS.outdated}
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
        <View style={{ paddingTop: 4 }}>
          <View style={{ borderRadius: forma.lap, borderWidth: 2, borderColor: szin.tintakek, padding: 16 }}>
            <View style={{ alignSelf: 'flex-start', height: 26, paddingHorizontal: 10, borderRadius: 13, backgroundColor: szin.gombMAlap, justifyContent: 'center' }}>
              <T m={13.5} s={700} c={szin.tintakekSzoveg}>
                {CLOSING_TEXTS.helyettunkBadge}
              </T>
            </View>
            <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', marginTop: 10 }}>
              <Ikon3d nev="bevallas" pt={30} />
              <T m={18} s={650} lh={1.3} style={{ flex: 1 }}>
                {CLOSING_TEXTS.helyettunkTitle}
              </T>
            </View>
            <T m={16} lh={1.45} style={{ marginTop: 6 }}>
              {sz(CLOSING_TEXTS.helyettunkBody)}
            </T>
            {lock ? <ZaroltSor style={{ marginTop: 12 }} /> : <GombE cim={CHANGE_TEXTS.helyettunk.button} onPress={() => router.push(`/valtozas/${CLOSING_KIND}/kerem`)} style={{ marginTop: 12 }} />}
          </View>
          <GombM cim={CLOSING_TEXTS.selfButton} onPress={() => router.push(`/valtozas/${CLOSING_KIND}/utmutato`)} style={{ marginTop: 12 }} />
          <T m={14.5} c={szin.halvany} kozep style={{ marginTop: 6 }}>
            {CLOSING_TEXTS.selfLine}
          </T>
          <Pressable accessibilityRole="link" onPress={() => router.push(visszahivasUt('valtozas_utmutato', 'megszuntetes' as never))} style={{ alignSelf: 'center', paddingVertical: 12, marginBottom: 6 }}>
            <T m={15.5} s={650} c={szin.tintakekSzoveg}>
              {CLOSING_TEXTS.talkFirst}
            </T>
          </Pressable>
        </View>
      )}
      <Szakasz ikon="lakat" cim="Mire figyelj?" />
      <Lap style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
        {CLOSING_TEXTS.info.figyelj.map((f, i) => (
          <T key={i} m={16} lh={1.45} style={{ paddingLeft: BELJEBB, marginTop: i ? 6 : 0 }}>
            {`• ${sz(f)}`}
          </T>
        ))}
      </Lap>
      <View style={{ paddingTop: 8 }}>
        <Elakadtal forras="valtozas_utmutato" tema={'megszuntetes' as never} cim={CHANGE_TEXTS.hub.help} />
      </View>
    </Kepernyo>
  );
}

type MLap = 'igy' | 'datum' | 'alkalmazott' | 'elofizetes' | 'osszegzes';
const LAPOK: MLap[] = ['igy', 'datum', 'alkalmazott', 'elofizetes', 'osszegzes'];

export function MegszuntetesKerem() {
  const p = useLocalSearchParams<{ lap?: string }>();
  const me = useMe();
  const fn = me.data?.accountant?.firstName ?? 'a könyvelőd';
  const ker = useValtozasKer();
  const jelez = useJelzes();
  const [nap, setNap] = useState('');
  const [alkalmazott, setAlkalmazott] = useState<boolean | null>(null);
  const [hiba, setHiba] = useState<string | null>(null);
  const i = Math.max(0, Math.min(LAPOK.length - 1, Number(p.lap ?? 0) || 0));
  const lap = LAPOK[i]!;
  const dij = DIJ();
  const ma = maiNap();
  const iso = datumBe(nap);
  const ugrik = (n: number) => {
    setHiba(null);
    router.setParams({ lap: String(n) });
  };
  const ellenoriz = (): string | null => {
    if (lap === 'datum') {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return 'Írd be a dátumot így: 2026.12.31.';
      if (iso < napHozzaad(ma, CLOSING_RULES.minAheadDays)) return CLOSING_TEXTS.validationDatePast;
      if (iso > napHozzaad(ma, CLOSING_RULES.maxAheadDays)) return CLOSING_TEXTS.validationDateFar;
    }
    if (lap === 'alkalmazott' && alkalmazott === null) return 'Válaszd ki: igen vagy nem.';
    return null;
  };
  const kuldes = async () => {
    try {
      const change = { kind: CLOSING_KIND, closingOn: iso, hadEmployees: Boolean(alkalmazott) } as unknown as ChangeData;
      const r = await ker.mutateAsync({ kind: CLOSING_KIND as never, source: 'helyettunk_valtozas', change } as never);
      if (r.feeCharge && r.feeCharge.canPay) {
        jelez({ szoveg: `Megkaptuk. Fizesd ki a díjat, és ${fn} nekilát.`, kesz: true });
        return router.replace('/fiok/dijak');
      }
      jelez({ szoveg: fillPlaceholders(CHANGE_TEXTS.toast, { firstName: fn }), kesz: true });
      router.replace(`/valtozas/${CLOSING_KIND}`);
    } catch (e) {
      setHiba(hibaUzenet(e, 'Nem sikerült elküldeni. Próbáld újra.'));
    }
  };
  const tovabb = () => {
    const h = ellenoriz();
    if (h) return setHiba(h);
    if (lap === 'osszegzes') return void kuldes();
    ugrik(i + 1);
  };
  const gomb = lap === 'igy' ? 'Kezdjük' : lap === 'osszegzes' ? (dij.amountHuf > 0 ? fillPlaceholders(FEE_TEXTS.payButtonAmount, { dij: szam(dij.amountHuf) }) : CHANGE_TEXTS.send) : 'Tovább';
  const n = LAPOK.length - 1;
  return (
    <Kepernyo
      ful="fiok"
      fejlec={<UrlapFej vissza={() => (i > 0 ? ugrik(i - 1) : vissza(`/valtozas/${CLOSING_KIND}`))} szakasz={CLOSING_TEXTS.helyettunkTitle} />}
      dokk={<GombE cim={gomb} tolt={ker.isPending} onPress={tovabb} />}
    >
      {lap === 'igy' ? (
        <>
          <UrlapKerdes cim={CLOSING_TEXTS.helyettunkTitle} miert={fillPlaceholders(CLOSING_TEXTS.helyettunkBody, { firstName: fn, dij: szam(dij.amountHuf) })} />
          <IgyMegy fajta={CLOSING_KIND as never} fn={fn} dij={dij.amountHuf} />
          <SohaBelepes fn={fn} style={{ marginTop: 12 }} />
        </>
      ) : lap === 'datum' ? (
        <>
          <UrlapKerdes i={i} n={n} cim={CLOSING_TEXTS.formDateTitle} miert="Legkorábban holnap, legfeljebb 90 nap múlva." />
          <Mezo felirat="A megszűnés napja" value={nap} onChangeText={setNap} placeholder={datumEvvel(napHozzaad(ma, 30))} keyboardType="numbers-and-punctuation" />
          <T m={15.5} s={600} lh={1.45} c={szin.borostyanSzoveg} style={{ marginTop: 12 }}>
            {CLOSING_TEXTS.formDateWarn}
          </T>
        </>
      ) : lap === 'alkalmazott' ? (
        <>
          <UrlapKerdes i={i} n={n} cim={CLOSING_TEXTS.formEmployeesTitle} miert={`Ha volt, ${fn} a záró bevallásokban az ő adataival is számol.`} />
          <IgenNem ertek={alkalmazott} valt={setAlkalmazott} />
        </>
      ) : lap === 'elofizetes' ? (
        <>
          <UrlapKerdes i={i} n={n} cim={CLOSING_TEXTS.formSubTitle} />
          <Lap style={{ padding: 16 }}>
            <T m={16} lh={1.5}>
              {fillPlaceholders(CLOSING_TEXTS.formSubText, { evesDij: szam(FEE_DEFAULTS.eves_zaras.amountHuf) })}
            </T>
          </Lap>
        </>
      ) : (
        <>
          <UrlapKerdes i={i} n={n} cim="Ezt jelentjük be" miert="Ha valami nem stimmel, lépj vissza." />
          <Lap style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 6 }}>
              <T m={15} c={szin.halvany} style={{ width: 150 }}>
                {CLOSING_TEXTS.summaryDate}
              </T>
              <T m={15.5} s={600} style={{ flex: 1 }}>
                {/^\d{4}-\d{2}-\d{2}$/.test(iso) ? datumEvvel(iso) : nap}
              </T>
            </View>
            <View style={{ flexDirection: 'row', gap: 12, paddingVertical: 6 }}>
              <T m={15} c={szin.halvany} style={{ width: 150 }}>
                {CLOSING_TEXTS.summaryEmployees}
              </T>
              <T m={15.5} s={600} style={{ flex: 1 }}>
                {alkalmazott ? 'Igen' : 'Nem'}
              </T>
            </View>
          </Lap>
          <T m={15} lh={1.45} c={szin.halvany} style={{ marginTop: 10 }}>
            {`Díja: ${szam(dij.amountHuf)} Ft, előre fizetve. A fizetés után ${fn} nekilát; az utolsó lépés előtt még engedélyt kér tőled.`}
          </T>
        </>
      )}
      <HibaSzoveg szoveg={hiba} />
    </Kepernyo>
  );
}
