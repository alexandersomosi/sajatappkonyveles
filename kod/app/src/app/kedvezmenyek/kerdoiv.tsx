// SPEC §28.3.4 – adókedvezmény-kérdőív (K0–K12), egy kérdés egy képernyőn (C űrlap). Csak a releváns lapok jelennek
// meg, a haladás ezeket számolja; „Vissza” megtartja a válaszokat. Nevet, gyermek születési dátumát, TAJ-t, adóazonosítót
// NEM kérünk (adatminimalizálás): a gyermekek névtelen kártyák, magadról csak a születés éve és hónapja kell.
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { AllowanceAnswers, AllowanceChildAnswer, AllowanceClientPreview } from '@/_shared/api';
import { ALLOWANCE_QUESTION_TEXTS as Q, ALLOWANCE_TEXTS, fillPlaceholders } from '@/_shared/bekotes';
import { useKedvezmenyBecsles, useKedvezmenyek, useKedvezmenyValasz, useMe } from '@/api/hooks';
import { hibaUzenet } from '@/lib/hiba';
import { maiNap, szam } from '@/lib/format';
import { HonapValaszto, IgenNem, IgenNemSor, Kapszulak, Lepteto, UrlapFej, UrlapKerdes } from '@/kepernyok/Urlap';
import { szin } from '@/theme/tokens';
import { GombE, HibaSzoveg, Lap, Pipa } from '@/ui/alap';
import { Arckep, type Ikon3dNev } from '@/ui/kepek';
import { Betolt, Hiba, Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { Mezo } from '@/ui/Mezo';
import { T } from '@/ui/T';

type Lap = 'K0' | 'K1' | 'K2' | 'K3' | 'K4' | 'K5' | 'K6' | 'K7' | 'K8' | 'K9' | 'K10' | 'K11' | 'K12';

export const URES_VALASZ: AllowanceAnswers = {
  birthMonth: null, children: [], otherDependants: 0, pregnancy: null, mother: null, csaladiWho: null, csaladiSharePct: null, csjkWish: null,
  marriage: null, disability: null, benefit: null, healthConsent: false, note: null,
};
const UJ_GYEREK: AllowanceChildAnswer = { potlek: 'most', sajat: true, tartosBeteg: false, felvaltva: false, potlekKezdeteHo: null, potlekVegeHo: null };

/** Az igen/nem kérdések, amelyekre még nem felelt („null” = nincs válasz). */
interface Kapcsolok { gyerek: boolean | null; baba: boolean | null; hazas: boolean | null; fogyatekos: boolean | null; ellatas: boolean | null }

/** Melyik lapok kellenek a válaszok alapján (SPEC §28.3.4: csak a relevánsak). Exportálva a tesztekhez. */
export function lapok(a: AllowanceAnswers, k: Kapcsolok, nyugdijas = false): Lap[] {
  void nyugdijas;
  const l: Lap[] = ['K0', 'K1', 'K2'];
  if (k.gyerek) l.push('K3', 'K4');
  l.push('K5');
  if (k.gyerek || k.baba) l.push('K6', 'K7');
  l.push('K8', 'K9', 'K10');
  if (a.disability || a.children.some((c) => c.tartosBeteg)) l.push('K11');
  l.push('K12');
  return l;
}

const IKON: Record<Lap, Ikon3dNev> = { K0: 'igazolas', K1: 'tepnaptar', K2: 'fiok', K3: 'fiok', K4: 'fiok', K5: 'tepnaptar', K6: 'fiok', K7: 'szamolo', K8: 'igazolas', K9: 'irat', K10: 'ora', K11: 'lakat', K12: 'igazolas' };

export default function KedvezmenyKerdoiv() {
  const p = useLocalSearchParams<{ lap?: string }>();
  const ev = Number(maiNap().slice(0, 4));
  const q = useKedvezmenyek(ev);
  const me = useMe();
  const fn = me.data?.accountant?.firstName ?? 'a könyvelőd';
  const ment = useKedvezmenyValasz();
  const becsles = useKedvezmenyBecsles();
  const jelez = useJelzes();
  const [a, setA] = useState<AllowanceAnswers>(URES_VALASZ);
  const [k, setK] = useState<Kapcsolok>({ gyerek: null, baba: null, hazas: null, fogyatekos: null, ellatas: null });
  const [toltve, setToltve] = useState(false);
  const [hiba, setHiba] = useState<string | null>(null);
  const [elonezet, setElonezet] = useState<AllowanceClientPreview | null>(null);

  // előtöltés a korábbi válaszokból („Valami változott – módosítom”)
  useEffect(() => {
    if (toltve || !q.data) return;
    const v = q.data.answers;
    if (v) {
      setA({ ...URES_VALASZ, ...v });
      setK({ gyerek: v.children.length > 0, baba: !!v.pregnancy, hazas: !!v.marriage, fogyatekos: !!v.disability, ellatas: !!v.benefit });
    }
    setToltve(true);
  }, [q.data, toltve]);

  const sor = useMemo(() => lapok(a, k), [a, k]);
  const kert = p.lap === 'vege' ? sor.length - 1 : Math.max(0, Math.min(sor.length - 1, Number(p.lap ?? 0) || 0));
  const lap = sor[kert];
  const ugrik = (n: number) => {
    setHiba(null);
    router.setParams({ lap: String(n) });
  };
  const set = (x: Partial<AllowanceAnswers>) => setA((r) => ({ ...r, ...x }));

  useEffect(() => {
    if (lap !== 'K12') return;
    becsles.mutate({ year: ev, answers: a }, { onSuccess: setElonezet });
  }, [lap]); // eslint-disable-line react-hooks/exhaustive-deps

  if (q.isLoading || !toltve) return <Kepernyo ful="fiok"><Betolt /></Kepernyo>;
  if (q.error) return <Kepernyo ful="fiok"><Hiba hiba={q.error} ujra={() => void q.refetch()} /></Kepernyo>;

  // KATA: a kedvezmények nem hatnak (SPEC §28.K.11)
  if (q.data?.notForRegime) {
    return (
      <Kepernyo ful="fiok" fejlec={<UrlapFej vissza={() => vissza('/fiok')} szakasz="Adókedvezmények" />}>
        <UrlapKerdes cim={ALLOWANCE_TEXTS.kapu.title} miert={ALLOWANCE_TEXTS.kata} ikon="igazolas" />
      </Kepernyo>
    );
  }

  const ellenoriz = (): string | null => {
    const v = ALLOWANCE_TEXTS.validation;
    if (lap === 'K1' && !a.birthMonth) return v.birth;
    if (lap === 'K2' && k.gyerek == null) return 'Válaszd ki: igen vagy nem.';
    if (lap === 'K3' && !a.children.length) return v.childrenCount;
    if (lap === 'K5' && k.baba && !a.pregnancy?.dueMonth) return v.dueMonth;
    if (lap === 'K7' && a.csaladiWho === 'kozosen' && ((a.csaladiSharePct ?? 0) < 10 || (a.csaladiSharePct ?? 0) > 90)) return v.share;
    if (lap === 'K8' && k.hazas && a.marriage && a.marriage.month > maiNap().slice(0, 7)) return v.weddingFuture;
    if (lap === 'K8' && k.hazas && !a.marriage?.month) return v.birth;
    return null;
  };
  const tovabb = () => {
    const h = ellenoriz();
    if (h) return setHiba(h);
    ugrik(kert + 1);
  };
  const bekuld = async () => {
    // egészségügyi adat kifejezett hozzájárulás nélkül nem megy el (SPEC §28.3.2)
    const kuld: AllowanceAnswers = a.healthConsent ? a : { ...a, disability: null, children: a.children.map((c) => ({ ...c, tartosBeteg: false })) };
    try {
      await ment.mutateAsync({ year: ev, answers: kuld, submit: true });
      jelez({ szoveg: fillPlaceholders(ALLOWANCE_TEXTS.sentToast, { firstName: fn }), kesz: true });
      router.replace('/kedvezmenyek');
    } catch (e) {
      setHiba(hibaUzenet(e, 'Nem sikerült elküldeni. Próbáld újra.'));
    }
  };

  const vege = lap === 'K12';
  const nincs = vege && elonezet && !elonezet.items.length;
  const dokk = (
    <GombE
      cim={lap === 'K0' ? Q.K0.button : vege ? (nincs ? ALLOWANCE_TEXTS.semmi.button : Q.K12.send) : Q.next}
      tolt={ment.isPending}
      onPress={vege ? () => void bekuld() : tovabb}
    />
  );
  const fej = <UrlapFej vissza={() => (kert > 0 ? ugrik(kert - 1) : vissza('/kedvezmenyek'))} szakasz="Adókedvezmények" />;
  const sz = (s: string) => fillPlaceholders(s, { firstName: fn });
  const evek = { tol: 1940, ig: 2010 };

  return (
    <Kepernyo ful="fiok" fejlec={fej} dokk={dokk}>
      {lap === 'K0' ? (
        <>
          <UrlapKerdes cim={Q.K0.title} ikon="igazolas" />
          <T m={17} lh={1.5}>
            {sz(Q.K0.text)}
          </T>
        </>
      ) : lap === 'K12' ? (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <Arckep pt={40} gyuru />
            <T m={15} c={szin.halvany} style={{ flex: 1 }}>
              {`Utolsó lépés · ${fn} nézi át`}
            </T>
          </View>
          <UrlapKerdes cim={nincs ? ALLOWANCE_TEXTS.semmi.title : Q.K12.title} miert={nincs ? ALLOWANCE_TEXTS.semmi.body : null} />
          {becsles.isPending ? <Betolt szoveg="Számolunk…" /> : null}
          {elonezet?.items.length ? (
            <Lap kotott>
              {elonezet.items.map((x, i) => (
                <View key={x.kind} style={{ paddingVertical: 10, marginHorizontal: 16, borderTopWidth: i ? 1 : 0, borderTopColor: szin.hajszal }}>
                  <T m={16} s={600} lh={1.35}>
                    {x.label}
                  </T>
                  <T m={15} lh={1.4} c={szin.halvany} szam>
                    {x.onlyAnnual ? Q.K12.effectAnnual : x.effectYearHuf == null || x.effectYearHuf <= 0 ? Q.K12.effectQuarterly : fillPlaceholders(Q.K12.effect, { x: szam(x.effectYearHuf) })}
                  </T>
                </View>
              ))}
            </Lap>
          ) : null}
          {!nincs ? (
            <>
              <Mezo felirat={sz(Q.K12.note)} multiline value={a.note ?? ''} onChangeText={(t) => set({ note: t.slice(0, 500) || null })} style={{ marginTop: 16 }} />
              <T m={15} lh={1.4} c={szin.halvany} style={{ marginTop: 10 }}>
                {sz(Q.K12.sub)}
              </T>
              {(() => {
                const docs: string[] = [];
                if (a.children.length) docs.push('a családi pótlékról szóló határozat');
                if (a.marriage) docs.push('a házassági anyakönyvi kivonat');
                if ((a.disability || a.children.some((c) => c.tartosBeteg)) && a.healthConsent) docs.push('az orvosi igazolás');
                if (a.children.some((c) => c.felvaltva)) docs.push('a felváltva gondozásról szóló bírósági döntés vagy megállapodás');
                return docs.length ? (
                  <View style={{ marginTop: 14 }}>
                    <T m={15} s={600}>
                      {sz(Q.K12.keep)}
                    </T>
                    {docs.map((d) => (
                      <T key={d} m={15} lh={1.45} c={szin.halvany}>
                        {`• ${d}`}
                      </T>
                    ))}
                  </View>
                ) : null;
              })()}
            </>
          ) : null}
        </>
      ) : (
        <>
          <UrlapKerdes valtozo i={kert} n={sor.length - 1} cim={lap === 'K11' ? Q.K11.title : (Q[lap] as { title: string }).title} miert={lap === 'K11' ? null : sz((Q[lap] as { why?: string }).why ?? '')} ikon={IKON[lap]} />
          {lap === 'K1' ? <HonapValaszto ertek={a.birthMonth} valt={(v) => set({ birthMonth: v })} tol={evek.tol} ig={evek.ig} /> : null}
          {lap === 'K2' ? (
            <IgenNem
              ertek={k.gyerek}
              valt={(b) => {
                setK((x) => ({ ...x, gyerek: b }));
                if (!b) set({ children: [], otherDependants: 0 });
                else if (!a.children.length) set({ children: [UJ_GYEREK] });
              }}
            />
          ) : null}
          {lap === 'K3' ? (
            <>
              <Lepteto cim={Q.K3.count} ertek={a.children.length} min={1} max={12} valt={(n) => set({ children: Array.from({ length: n }, (_, i) => a.children[i] ?? UJ_GYEREK) })} />
              {a.children.map((c, i) => {
                const valt = (x: Partial<AllowanceChildAnswer>) => set({ children: a.children.map((g, j) => (j === i ? { ...g, ...x } : g)) });
                return (
                  <View key={i} style={{ marginTop: 14, paddingTop: 12, borderTopWidth: 10, borderTopColor: szin.sav, marginHorizontal: -16, paddingHorizontal: 16 }}>
                    <T m={18} s={650} style={{ marginBottom: 8 }}>
                      {fillPlaceholders(Q.K3.card, { n: String(i + 1) })}
                    </T>
                    <Kapszulak
                      oszlop
                      elemek={[
                        { kulcs: 'most', cim: Q.K3.potlekMost },
                        { kulcs: 'tizenket_ev', cim: Q.K3.potlekTizenketEv },
                        { kulcs: 'nem', cim: Q.K3.potlekNem },
                      ]}
                      ertek={c.potlek === 'elhunyt' ? 'nem' : c.potlek}
                      valt={(v) => valt({ potlek: v as AllowanceChildAnswer['potlek'] })}
                    />
                    {c.potlek === 'nem' || c.potlek === 'elhunyt' ? (
                      <Pipa be={c.potlek === 'elhunyt'} valt={(b) => valt({ potlek: b ? 'elhunyt' : 'nem' })} style={{ marginTop: 8 }}>
                        {Q.K3.elhunyt}
                      </Pipa>
                    ) : null}
                    {c.potlek === 'most' ? (
                      <View style={{ marginTop: 8 }}>
                        <IgenNemSor elso cim={Q.K3.kezdete} ertek={!!c.potlekKezdeteHo} valt={(b) => valt({ potlekKezdeteHo: b ? `${maiNap().slice(0, 4)}-01` : null })} />
                        {c.potlekKezdeteHo ? <HonapValaszto ertek={c.potlekKezdeteHo} valt={(v) => valt({ potlekKezdeteHo: v })} tol={ev} ig={ev} /> : null}
                        <IgenNemSor cim={Q.K3.vege} ertek={!!c.potlekVegeHo} valt={(b) => valt({ potlekVegeHo: b ? `${maiNap().slice(0, 4)}-06` : null })} />
                        {c.potlekVegeHo ? <HonapValaszto ertek={c.potlekVegeHo} valt={(v) => valt({ potlekVegeHo: v })} tol={ev} ig={ev} /> : null}
                      </View>
                    ) : null}
                    <IgenNemSor cim={Q.K3.sajat} ertek={c.sajat} valt={(b) => valt({ sajat: b })} />
                    <IgenNemSor cim={Q.K3.tartosBeteg} ertek={c.tartosBeteg} valt={(b) => valt({ tartosBeteg: b })} />
                    <IgenNemSor cim={Q.K3.felvaltva} ertek={c.felvaltva} valt={(b) => valt({ felvaltva: b })} />
                  </View>
                );
              })}
            </>
          ) : null}
          {lap === 'K4' ? <Lepteto cim="Más eltartott" ertek={a.otherDependants} min={0} max={9} valt={(n) => set({ otherDependants: n })} /> : null}
          {lap === 'K5' ? (
            <>
              <IgenNem
                ertek={k.baba}
                valt={(b) => {
                  setK((x) => ({ ...x, baba: b }));
                  if (!b) set({ pregnancy: null });
                }}
              />
              {k.baba ? <HonapValaszto cim={Q.K5.when} ertek={a.pregnancy?.dueMonth ?? null} valt={(v) => set({ pregnancy: { dueMonth: v } })} tol={ev} ig={ev + 1} /> : null}
            </>
          ) : null}
          {lap === 'K6' ? <IgenNem ertek={a.mother} valt={(b) => set({ mother: b })} /> : null}
          {lap === 'K7' ? (
            <>
              <Kapszulak
                oszlop
                elemek={[
                  { kulcs: 'en', cim: Q.K7.en },
                  { kulcs: 'par', cim: Q.K7.par },
                  { kulcs: 'kozosen', cim: Q.K7.kozosen },
                ]}
                ertek={a.csaladiWho}
                valt={(v) => set({ csaladiWho: v as AllowanceAnswers['csaladiWho'], csaladiSharePct: v === 'kozosen' ? (a.csaladiSharePct ?? 50) : null })}
              />
              {a.csaladiWho === 'kozosen' ? (
                <Lepteto cim={`${Q.K7.share} ${a.csaladiSharePct ?? 50}%`} ertek={(a.csaladiSharePct ?? 50) / 10} min={1} max={9} valt={(n) => set({ csaladiSharePct: n * 10 })} />
              ) : null}
              {a.csaladiWho === 'en' || a.csaladiWho === 'kozosen' ? (
                <View style={{ marginTop: 16 }}>
                  <T m={16} s={600} lh={1.4} style={{ marginBottom: 8 }}>
                    {Q.K7.csjk}
                  </T>
                  <Kapszulak
                    elemek={[
                      { kulcs: 'igen', cim: Q.K7.csjkIgen },
                      { kulcs: 'konyvelo_donti', cim: sz(Q.K7.csjkKonyvelo) },
                    ]}
                    ertek={a.csjkWish}
                    valt={(v) => set({ csjkWish: v as AllowanceAnswers['csjkWish'] })}
                  />
                </View>
              ) : null}
            </>
          ) : null}
          {lap === 'K8' ? (
            <>
              <IgenNem
                ertek={k.hazas}
                valt={(b) => {
                  setK((x) => ({ ...x, hazas: b }));
                  set({ marriage: b ? (a.marriage ?? { month: '', first: true, who: 'en' }) : null });
                }}
              />
              {k.hazas && a.marriage ? (
                <View style={{ marginTop: 16, gap: 16 }}>
                  <HonapValaszto cim={Q.K8.when} ertek={a.marriage.month || null} valt={(v) => set({ marriage: { ...a.marriage!, month: v } })} tol={ev - 2} ig={ev} />
                  <T m={15} s={600}>
                    {Q.K8.who}
                  </T>
                  <Kapszulak
                    elemek={[
                      { kulcs: 'en', cim: Q.K8.en },
                      { kulcs: 'par', cim: Q.K8.par },
                      { kulcs: 'kozosen', cim: Q.K8.kozosen },
                    ]}
                    ertek={a.marriage.who}
                    valt={(v) => set({ marriage: { ...a.marriage!, who: v as 'en' | 'par' | 'kozosen' } })}
                  />
                </View>
              ) : null}
            </>
          ) : null}
          {lap === 'K9' ? (
            <>
              <IgenNem
                ertek={k.fogyatekos}
                valt={(b) => {
                  setK((x) => ({ ...x, fogyatekos: b }));
                  set({ disability: b ? (a.disability ?? { fromMonth: null, basis: 'orvosi_igazolas' }) : null });
                }}
              />
              {k.fogyatekos && a.disability ? (
                <View style={{ marginTop: 16, gap: 12 }}>
                  <T m={15} s={600}>
                    {Q.K9.basis}
                  </T>
                  <Kapszulak
                    oszlop
                    elemek={[
                      { kulcs: 'orvosi_igazolas', cim: Q.K9.orvosi },
                      { kulcs: 'rokkantsagi_jaradek', cim: Q.K9.jaradek },
                      { kulcs: 'fogyatekossagi_tamogatas', cim: Q.K9.tamogatas },
                    ]}
                    ertek={a.disability.basis}
                    valt={(v) => set({ disability: { ...a.disability!, basis: v as NonNullable<AllowanceAnswers['disability']>['basis'] } })}
                  />
                  <IgenNemSor elso cim={Q.K9.regebb} ertek={a.disability.fromMonth == null} valt={(b) => set({ disability: { ...a.disability!, fromMonth: b ? null : `${ev}-01` } })} />
                  {a.disability.fromMonth ? <HonapValaszto cim={Q.K9.since} ertek={a.disability.fromMonth} valt={(v) => set({ disability: { ...a.disability!, fromMonth: v } })} tol={ev - 5} ig={ev} /> : null}
                </View>
              ) : null}
            </>
          ) : null}
          {lap === 'K10' ? (
            <>
              <IgenNem
                ertek={k.ellatas}
                valt={(b) => {
                  setK((x) => ({ ...x, ellatas: b }));
                  set({ benefit: b ? (a.benefit ?? { fromMonth: `${ev}-01`, toMonth: null }) : null });
                }}
              />
              {k.ellatas && a.benefit ? (
                <View style={{ marginTop: 16, gap: 12 }}>
                  <HonapValaszto cim={Q.K10.from} ertek={a.benefit.fromMonth} valt={(v) => set({ benefit: { ...a.benefit!, fromMonth: v } })} tol={ev - 1} ig={ev} />
                  <IgenNemSor elso cim={Q.K10.still} ertek={a.benefit.toMonth == null} valt={(b) => set({ benefit: { ...a.benefit!, toMonth: b ? null : `${ev}-12` } })} />
                  {a.benefit.toMonth ? <HonapValaszto cim={Q.K10.to} ertek={a.benefit.toMonth} valt={(v) => set({ benefit: { ...a.benefit!, toMonth: v } })} tol={ev} ig={ev + 1} /> : null}
                </View>
              ) : null}
            </>
          ) : null}
          {lap === 'K11' ? (
            <>
              <Pipa be={a.healthConsent} valt={(b) => set({ healthConsent: b })}>
                {sz(Q.K11.consent)}
              </Pipa>
              {!a.healthConsent ? (
                <T m={15} s={600} lh={1.45} c={szin.borostyanSzoveg} style={{ marginTop: 10 }}>
                  {Q.K11.noConsent}
                </T>
              ) : null}
            </>
          ) : null}
        </>
      )}
      <HibaSzoveg szoveg={hiba} />
    </Kepernyo>
  );
}
