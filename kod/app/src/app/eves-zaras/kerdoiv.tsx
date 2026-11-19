// SPEC §28.K.3 – éves zárás kérdőív (E0–E8), egy kérdés egy képernyőn (C űrlap). A válaszok lapozáskor mentődnek
// (PUT …/answers); a végén összegzés + az éves zárás díja (DEMO jellel, amíg nincs véglegesítve) → „Elküldöm és fizetek”.
// A visszatérítési bankszámlát a szerver titkosítva tárolja, és mindenhol maszkolva mutatja.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { AnnualAnswers } from '@/_shared/api';
import { ANNUAL_TEXTS as E, fillPlaceholders, OTHER_INCOME_LABELS } from '@/_shared/bekotes';
import { FEE_DEFAULTS, OTHER_INCOME_KINDS, OTHER_INCOME_KNOWN_TO_NAV, type OtherIncomeKind } from '@/_shared/enums';
import { useEvesBekuld, useEvesValasz, useEvesZaras, useKedvezmenyek, useMe } from '@/api/hooks';
import { hibaUzenet } from '@/lib/hiba';
import { maiNap, szam } from '@/lib/format';
import { dijFizetes } from '@/lib/simplepay';
import { DemoDij } from '@/kepernyok/k28';
import { IgenNem, Kapszulak, UrlapFej, UrlapKerdes } from '@/kepernyok/Urlap';
import { szin } from '@/theme/tokens';
import { GombE, GombM, HibaSzoveg, Lap } from '@/ui/alap';
import { Betolt, Hiba, Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { Mezo } from '@/ui/Mezo';
import { T } from '@/ui/T';

type L = 'E0' | 'E1' | 'E2' | 'E3' | 'E4' | 'E5' | 'E6' | 'E7' | 'E8';
const URES: AnnualAnswers = { otherIncomes: [], otherIncomeNote: null, allowancesOk: null, hipaPlace: null, hipaOtherTowns: [], municipalityLetter: null, onePercent: null, refundAccountMasked: null, missingDocuments: null, message: null };

export default function EvesKerdoiv() {
  const p = useLocalSearchParams<{ lap?: string }>();
  const ev = Number(maiNap().slice(0, 4));
  const q = useEvesZaras(ev);
  const me = useMe();
  const fn = me.data?.accountant?.firstName ?? 'a könyvelőd';
  const kedv = useKedvezmenyek(ev);
  const ment = useEvesValasz();
  const bekuld = useEvesBekuld();
  const jelez = useJelzes();
  const [a, setA] = useState<AnnualAnswers>(URES);
  const [szamla, setSzamla] = useState('');
  const [egyszazalek, setEgyszazalek] = useState<boolean | null>(null);
  const [toltve, setToltve] = useState(false);
  const [hiba, setHiba] = useState<string | null>(null);
  const z = q.data;
  useEffect(() => {
    if (toltve || !z) return;
    if (z.answers) setA({ ...URES, ...z.answers });
    setToltve(true);
  }, [z, toltve]);

  if (q.isLoading || (z && !toltve)) return <Kepernyo ful="fooldal"><Betolt /></Kepernyo>;
  if (q.error) return <Kepernyo ful="fooldal"><Hiba hiba={q.error} ujra={() => void q.refetch()} /></Kepernyo>;
  if (!z || !z.canEdit) {
    return (
      <Kepernyo ful="fooldal" fejlec={<UrlapFej vissza={() => vissza('/eves-zaras')} szakasz="Éves zárás" />}>
        <UrlapKerdes cim="Most nincs kitöltenivaló" miert={z?.statusText ?? 'Január 5-én nyílik. Szólunk, ha kitöltheted.'} ikon="bevallas" />
      </Kepernyo>
    );
  }
  const kata = z.regime === 'kata';
  const lapok: L[] = ['E0', 'E1', 'E2', 'E3', ...(kata && !a.otherIncomes.some((x) => x !== 'nem_volt') ? [] : (['E4'] as L[])), 'E5', 'E6', 'E7', 'E8'];
  const i = Math.max(0, Math.min(lapok.length - 1, Number(p.lap ?? 0) || 0));
  const lap = lapok[i];
  const dij = FEE_DEFAULTS.eves_zaras;
  const sz = (s: string) => fillPlaceholders(s, { firstName: fn, ev: String(z.year), dij: szam(dij.amountHuf) });
  const set = (x: Partial<AnnualAnswers>) => setA((r) => ({ ...r, ...x }));
  const ugrik = (n: number) => {
    setHiba(null);
    router.setParams({ lap: String(n) });
  };
  const tovabb = async () => {
    if (lap === 'E1' && !a.otherIncomes.length) return setHiba('Válassz legalább egyet (vagy: Nem volt).');
    if (lap === 'E3' && !a.hipaPlace) return setHiba('Válassz egyet.');
    try {
      if (lap !== 'E0') {
        // only the editable answers: refundAccountMasked is view-only (the strict schema refused it: "Ismeretlen mező.")
        const { refundAccountMasked: _csakNezet, refundAccount: _r, ...valasz } = a;
        await ment.mutateAsync({ id: z.id, answers: { ...valasz, ...(szamla ? { refundAccount: szamla } : {}) } });
      }
      if (lap === 'E8') {
        const r = await bekuld.mutateAsync(z.id);
        if (r.feeCharge?.canPay) return void (await dijFizetes(r.feeCharge.id));
        jelez({ szoveg: sz(E.sentToast), kesz: true });
        return router.replace('/eves-zaras');
      }
      ugrik(i + 1);
    } catch (e) {
      setHiba(hibaUzenet(e, 'Nem sikerült menteni. Próbáld újra.'));
    }
  };
  const gomb = lap === 'E0' ? E.E0.button : lap === 'E8' ? E.E8.button : 'Tovább';
  return (
    <Kepernyo ful="fooldal" fejlec={<UrlapFej vissza={() => (i > 0 ? ugrik(i - 1) : vissza('/eves-zaras'))} szakasz={sz(E.card.title)} />} dokk={<GombE cim={gomb} tolt={ment.isPending || bekuld.isPending} onPress={() => void tovabb()} />}>
      {lap === 'E0' ? (
        <>
          <UrlapKerdes cim={sz(E.E0.title)} ikon="bevallas" />
          <T m={17} lh={1.5}>
            {sz(kata ? E.E0.textKata : E.E0.text)}
          </T>
          {!dij.confirmed ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10 }}>
              <T m={15} c={szin.halvany}>
                A díj még nincs véglegesítve.
              </T>
              <DemoDij />
            </View>
          ) : null}
        </>
      ) : null}
      {lap === 'E1' ? (
        <>
          <UrlapKerdes i={i} n={lapok.length - 1} cim={E.E1.title} miert={E.E1.why} />
          <Kapszulak
            oszlop
            tobb
            elemek={OTHER_INCOME_KINDS.map((k) => ({ kulcs: k, cim: OTHER_INCOME_LABELS[k] }))}
            ertek={a.otherIncomes}
            valt={(k: OtherIncomeKind) =>
              set({ otherIncomes: k === 'nem_volt' ? ['nem_volt'] : a.otherIncomes.includes(k) ? a.otherIncomes.filter((x) => x !== k) : [...a.otherIncomes.filter((x) => x !== 'nem_volt'), k] })
            }
          />
          {a.otherIncomes.some((x) => x !== 'nem_volt' && !OTHER_INCOME_KNOWN_TO_NAV.includes(x)) ? (
            <T m={15.5} lh={1.45} s={600} style={{ marginTop: 12 }}>
              {sz(E.E1.followUp)}
            </T>
          ) : null}
        </>
      ) : null}
      {lap === 'E2' ? (
        <>
          <UrlapKerdes i={i} n={lapok.length - 1} cim={E.E2.title} miert={kata ? sz(E.E2.kata) : null} />
          {!kata ? (
            <>
              <Lap kotott>
                {(kedv.data?.items ?? []).filter((x) => x.status === 'jovahagyva').map((x, n) => (
                  <View key={x.kind} style={{ paddingVertical: 10, marginHorizontal: 16, borderTopWidth: n ? 1 : 0, borderTopColor: szin.hajszal }}>
                    <T m={16} s={600}>
                      {x.label}
                    </T>
                    <T m={15} c={szin.halvany}>
                      {x.statusText}
                    </T>
                  </View>
                ))}
                {!(kedv.data?.items ?? []).some((x) => x.status === 'jovahagyva') ? (
                  <T m={16} lh={1.45} style={{ marginHorizontal: 16, paddingVertical: 10 }}>
                    Idén nincs jóváhagyott kedvezményed.
                  </T>
                ) : null}
              </Lap>
              <View style={{ marginTop: 12, gap: 10 }}>
                <Kapszulak oszlop elemek={[{ kulcs: 'ok', cim: E.E2.ok }]} ertek={a.allowancesOk ? 'ok' : null} valt={() => set({ allowancesOk: true })} />
                <GombM cim={E.E2.changed} onPress={() => (set({ allowancesOk: false }), router.push('/kedvezmenyek/kerdoiv'))} />
              </View>
            </>
          ) : null}
        </>
      ) : null}
      {lap === 'E3' ? (
        <>
          <UrlapKerdes i={i} n={lapok.length - 1} cim={E.E3.title} />
          <Kapszulak oszlop elemek={[{ kulcs: 'csak_szekhely', cim: E.E3.csakSzekhely }, { kulcs: 'mas_telepulesen_is', cim: E.E3.masHol }]} ertek={a.hipaPlace} valt={(k) => set({ hipaPlace: k as AnnualAnswers['hipaPlace'] })} />
          {a.hipaPlace === 'mas_telepulesen_is' ? (
            <Mezo
              felirat={E.E3.where}
              multiline
              value={a.hipaOtherTowns.map((t) => `${t.town} – ${t.days} nap`).join('\n')}
              onChangeText={(t) => set({ hipaOtherTowns: t.split('\n').filter(Boolean).map((s) => ({ town: s.split('–')[0].trim(), days: Number((s.split('–')[1] ?? '').replace(/\D/g, '')) || 0 })) })}
              style={{ marginTop: 12 }}
            />
          ) : null}
          <T m={16} s={600} lh={1.4} style={{ marginTop: 16, marginBottom: 8 }}>
            {E.E3.letter}
          </T>
          <IgenNem ertek={a.municipalityLetter} valt={(b) => set({ municipalityLetter: b })} />
          {a.municipalityLetter ? <GombM cim="Feltöltöm a levelet" ikon="feltoltes" onPress={() => router.push({ pathname: '/feltoltes', params: { kategoria: 'nav_level' } })} style={{ marginTop: 10 }} /> : null}
        </>
      ) : null}
      {lap === 'E4' ? (
        <>
          <UrlapKerdes i={i} n={lapok.length - 1} cim={E.E4.title} />
          <Kapszulak elemek={[{ kulcs: 'igen', cim: 'Igen' }, { kulcs: 'nem', cim: E.E4.skip }]} ertek={egyszazalek == null ? (a.onePercent ? 'igen' : null) : egyszazalek ? 'igen' : 'nem'} valt={(k) => (setEgyszazalek(k === 'igen'), set({ onePercent: k === 'igen' ? (a.onePercent ?? { civilAdoszam: null, egyhazTechnikaiSzam: null }) : null }))} />
          {a.onePercent ? (
            <View style={{ gap: 12, marginTop: 12 }}>
              <Mezo felirat={E.E4.civil} value={a.onePercent.civilAdoszam ?? ''} onChangeText={(t) => set({ onePercent: { ...a.onePercent!, civilAdoszam: t || null } })} />
              <Mezo felirat={E.E4.egyhaz} value={a.onePercent.egyhazTechnikaiSzam ?? ''} onChangeText={(t) => set({ onePercent: { ...a.onePercent!, egyhazTechnikaiSzam: t || null } })} />
            </View>
          ) : null}
        </>
      ) : null}
      {lap === 'E5' ? (
        <>
          <UrlapKerdes i={i} n={lapok.length - 1} cim={E.E5.title} />
          <Mezo felirat={E.E5.field} keyboardType="number-pad" value={szamla} placeholder={a.refundAccountMasked ?? '12345678-12345678-12345678'} onChangeText={(t) => setSzamla(t.replace(/[^\d-]/g, '').slice(0, 26))} sugo="Titkosítva tároljuk, és csak maszkolva mutatjuk." />
        </>
      ) : null}
      {lap === 'E6' ? (
        <>
          <UrlapKerdes i={i} n={lapok.length - 1} cim={sz(E.E6.title)} miert={E.E6.hint} />
          <IgenNem ertek={a.missingDocuments} valt={(b) => set({ missingDocuments: b })} />
          {a.missingDocuments ? <GombM cim="Feltöltöm" ikon="feltoltes" onPress={() => router.push('/feltoltes')} style={{ marginTop: 10 }} /> : null}
        </>
      ) : null}
      {lap === 'E7' ? (
        <>
          <UrlapKerdes i={i} n={lapok.length - 1} cim={sz(E.E7.title)} />
          <Mezo felirat="Üzenet" multiline value={a.message ?? ''} onChangeText={(t) => set({ message: t.slice(0, 1000) || null })} />
        </>
      ) : null}
      {lap === 'E8' ? (
        <>
          <UrlapKerdes i={i} n={lapok.length - 1} cim={E.E8.title} />
          <Lap kotott style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            <T m={16} lh={1.5}>{`Más jövedelem: ${a.otherIncomes.map((x) => OTHER_INCOME_LABELS[x]).join(', ') || '–'}`}</T>
            {!kata ? <T m={16} lh={1.5}>{`Kedvezmények: ${a.allowancesOk === false ? 'változott' : 'rendben'}`}</T> : null}
            <T m={16} lh={1.5}>{`Hol dolgoztál: ${a.hipaPlace === 'mas_telepulesen_is' ? E.E3.masHol : E.E3.csakSzekhely}`}</T>
            <T m={16} lh={1.5}>{`Visszatérítés: ${szamla ? 'megadtad' : a.refundAccountMasked ?? 'nem adtad meg'}`}</T>
          </Lap>
          <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginTop: 12 }}>
            <T m={17} s={650} szam>
              {sz(E.E8.feeRow)}
            </T>
            {!dij.confirmed ? <DemoDij /> : null}
          </View>
        </>
      ) : null}
      <HibaSzoveg szoveg={hiba} />
    </Kepernyo>
  );
}
