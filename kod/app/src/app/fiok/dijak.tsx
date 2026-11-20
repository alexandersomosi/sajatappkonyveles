// SPEC §28.K.1 + §29.1.7 / §29.1.13 – Fiók → Díjak és számlák: the open charges ("Fizetek"), our fee table (the real
// prices, no DEMO chip since §29.4.1), the paid ones and EVERY fee invoice (number, date, amount, "PDF" = the stored
// Számlázz.hu PDF; a reversed one says "Sztornózva" and has the storno PDF too). Paying: the pay sheet says before the
// tap what happens ("{label}: {osszeg} Ft. A kártyádról vonjuk le ({kartya}).") – "Fizetek ({osszeg} Ft)" uses the saved
// card, "Másik kártyával" opens the Stripe page. PAYMENT_PROVIDER=simplepay → the kept SimplePay one-off payment.
// Előtte: kod/app/_regi/elotte_k7_b3/src/app/fiok/dijak.tsx
import { useEffect, useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import type { FeeChargeView } from '@/_shared/api';
import { FEE_TEXTS, FEE_UNIT_LABELS, fillPlaceholders } from '@/_shared/bekotes';
import { PAYMENT_SCREEN_TEXTS as P, type FeeInvoiceItemK29 } from '@/_shared/k29';
import { K, useConfig, useDijak } from '@/api/hooks';
import { K29, useDijszamlakK29, useElofizetesK29 } from '@/api/hooks-k29';
import { fajlMegnyit } from '@/lib/fajlok';
import { hibaUzenet } from '@/lib/hiba';
import { datumEvvel, szam } from '@/lib/format';
import { dijFizetesK29, fizetesSzolgaltato } from '@/lib/fizetes';
import { dijFizetes } from '@/lib/simplepay';
import { szin } from '@/theme/tokens';
import { Allapot, Cimke, GombE, GombM, GombSz, HibaSzoveg, Lap, Osszeg, Sor, Szakasz } from '@/ui/alap';
import { DemoFizetesJel } from '@/ui/DemoJel';
import { AlsoLap, Betolt, CimSor, Hiba, Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { T } from '@/ui/T';

export default function Dijak() {
  const p = useLocalSearchParams<{ fizetve?: string; o?: string }>();
  const cfg = useConfig();
  const q = useDijak();
  const szamlak = useDijszamlakK29();
  const elo = useElofizetesK29();
  const qc = useQueryClient();
  const jelez = useJelzes();
  const [lap, setLap] = useState<FeeChargeView | null>(null);
  const [tolt, setTolt] = useState<'mentett' | 'masik' | null>(null);
  const [lapHiba, setLapHiba] = useState<string | null>(null);
  const v = q.data;
  const simplepay = fizetesSzolgaltato(cfg.data) === 'simplepay';
  const demo = !!cfg.data?.demo && fizetesSzolgaltato(cfg.data) === 'demo';
  const kartya = elo.data?.cardInfo && elo.data.cardInfo.status === 'aktiv' ? elo.data.cardInfo : null;
  useEffect(() => {
    // visszatérés a fizetésből: a szerver szerinti állapotot töltjük újra
    if (p.fizetve || p.o) void q.refetch();
  }, [p.fizetve, p.o]); // eslint-disable-line react-hooks/exhaustive-deps

  const nyit = async (d: FeeChargeView) => {
    if (simplepay) {
      try {
        await dijFizetes(d.id);
      } catch (e) {
        jelez(hibaUzenet(e, FEE_TEXTS.payFailed));
      }
      return;
    }
    setLapHiba(null);
    setLap(d);
  };
  const fizet = async (mentett: boolean) => {
    if (!lap) return;
    setLapHiba(null);
    setTolt(mentett ? 'mentett' : 'masik');
    try {
      const r = await dijFizetesK29(lap.id, mentett);
      if (r.result === 'sikeres') {
        setLap(null);
        jelez({ szoveg: P.fees.paid, kesz: true });
        for (const k of [['dijak'], K.dijszamlak, K29.szamlak, K.home, K.me]) void qc.invalidateQueries({ queryKey: k });
      } else if (r.result === 'sikertelen') setLapHiba(r.message);
      else setLap(null);
    } catch (e) {
      setLapHiba(hibaUzenet(e, FEE_TEXTS.payFailed));
    } finally {
      setTolt(null);
    }
  };

  const elso = v?.open.find((d) => d.canPay) ?? null;
  const lista = (szamlak.data ?? v?.invoices ?? []) as FeeInvoiceItemK29[];
  return (
    <Kepernyo
      ful="fiok"
      fejlec={<CimSor visszaCim="Vissza a Fiókhoz" vissza={() => vissza('/fiok')} cim={FEE_TEXTS.screenTitle} al={v?.inPlan ?? FEE_TEXTS.inPlan} />}
      dokk={elso ? <GombE cim={fillPlaceholders(FEE_TEXTS.payButtonAmount, { dij: szam(elso.amountHuf) })} onPress={() => void nyit(elso)} /> : undefined}
    >
      {q.isLoading ? (
        <Betolt />
      ) : q.error || !v ? (
        <Hiba hiba={q.error} ujra={() => void q.refetch()} />
      ) : (
        <>
          {v.open.length ? (
            <>
              <Szakasz ikon="szamlaszam" cim={FEE_TEXTS.openTitle} />
              <Lap>
                {v.open.map((d, i) => (
                  <Sor
                    key={d.id}
                    elso={i === 0}
                    cim={d.label}
                    al={d.statusText || (d.purpose.type === 'eves_zaras' ? 'A fizetés után nekilátunk az éves zárásnak.' : 'A fizetés után nekilátunk.')}
                    jobbra={
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <Osszeg szoveg={szam(d.amountHuf)} m={16} />
                        {i > 0 && d.canPay ? <GombM cim={FEE_TEXTS.payButton} onPress={() => void nyit(d)} /> : null}
                      </View>
                    }
                  />
                ))}
              </Lap>
            </>
          ) : null}
          <Szakasz ikon="szamolo" cim="A díjaink" megj={FEE_TEXTS.selfFree} />
          <Lap>
            {v.table.map((t, i) => (
              <Sor
                key={t.kind}
                elso={i === 0}
                cim={t.label}
                jobbra={
                  <View style={{ alignItems: 'flex-end' }}>
                    <T m={16} s={650} szam>
                      {szam(t.amountHuf)} Ft
                    </T>
                    <T m={13.5} c={szin.halvany}>
                      {FEE_UNIT_LABELS[t.unit]}
                    </T>
                  </View>
                }
              />
            ))}
          </Lap>
          {v.paid.length ? (
            <>
              <Szakasz ikon="befizetve" cim={FEE_TEXTS.paidTitle} />
              <Lap>
                {v.paid.map((d, i) => (
                  <Sor key={d.id} elso={i === 0} cim={d.label} al={d.paidAt ? `Kifizetve ${datumEvvel(d.paidAt)}` : d.statusText} jobbra={<Osszeg szoveg={szam(d.amountHuf)} m={16} />} />
                ))}
              </Lap>
            </>
          ) : null}
          <Szakasz ikon="irat" cim={FEE_TEXTS.invoicesTitle} megj={lista.some((x) => x.demo) ? 'DEMO: ezek díjbekérők, nem valódi számlák.' : 'A számlát a Számlázz.hu e-mailben is elküldi.'} />
          <Lap>
            {lista.length ? (
              lista.map((d, i) => <SzamlaSor key={d.id} d={d} elso={i === 0} hiba={(e) => jelez(hibaUzenet(e, 'Nem sikerült. Próbáld újra.'))} />)
            ) : (
              <T m={16} c={szin.halvany} style={{ padding: 16 }}>
                Még nincs díjszámlád.
              </T>
            )}
          </Lap>
        </>
      )}

      <AlsoLap lathato={!!lap} bezar={() => setLap(null)}>
        {lap ? (
          <View style={{ paddingTop: 8 }}>
            <T m={21} s={650} ls={-0.02} lh={1.25} style={{ paddingRight: 90 }} accessibilityRole="header">
              {lap.label}
            </T>
            {demo ? <DemoFizetesJel style={{ marginTop: 10, marginBottom: 0 }} /> : null}
            <T m={16} lh={1.5} style={{ marginTop: 10 }}>
              {kartya ? fillPlaceholders(P.fees.payLine, { label: lap.label, osszeg: szam(lap.amountHuf), kartya: kartya.label }) : `${lap.label}: ${szam(lap.amountHuf)} Ft. A Stripe biztonságos oldalán fizeted ki.`}
            </T>
            <HibaSzoveg szoveg={lapHiba} />
            <GombE cim={fillPlaceholders(P.fees.payButton, { osszeg: szam(lap.amountHuf) })} tolt={tolt === 'mentett'} disabled={!!tolt} onPress={() => void fizet(!!kartya)} style={{ marginTop: 18 }} />
            {kartya ? <GombM cim={P.fees.otherCard} tolt={tolt === 'masik'} disabled={!!tolt} onPress={() => void fizet(false)} style={{ alignSelf: 'center', marginTop: 10 }} /> : null}
            <GombSz cim="Mégse" onPress={() => setLap(null)} style={{ alignSelf: 'center', marginTop: 4 }} />
          </View>
        ) : null}
      </AlsoLap>
    </Kepernyo>
  );
}

function SzamlaSor({ d, elso, hiba }: { d: FeeInvoiceItemK29; elso: boolean; hiba: (e: unknown) => void }) {
  const sztorno = d.status === 'sztorno';
  const kesz = !d.status || d.status === 'kiallitva' || d.status === 'sztorno';
  const nyit = (id: string, nev: string) => fajlMegnyit(id, nev).catch(hiba);
  const cim = d.kind === 'sztorno' ? `Sztornó: ${d.number}` : d.kind === 'helyesbito' ? `Helyesbítő: ${d.number}` : d.number || 'Számla';
  const ut = d.status === 'folyamatban' ? 'készül' : d.status === 'hiba' ? 'készül, kis türelmet' : d.demo ? 'DEMO, nem számla' : d.label;
  return (
    <Sor
      elso={elso}
      cim={cim}
      al={
        <View>
          <Allapot szo={d.issuedOn ? datumEvvel(d.issuedOn) : 'Készül'} utana={ut ?? undefined} m={15} />
          {sztorno || d.stornoFileId ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 6, flexWrap: 'wrap' }}>
              <Cimke szoveg={P.fees.storno} style={{ alignSelf: 'flex-start' }} />
              {d.stornoFileId ? <GombSz cim="Sztornó PDF" m={14.5} onPress={() => void nyit(d.stornoFileId!, `${d.number}_sztorno.pdf`)} style={{ paddingVertical: 2 }} /> : null}
            </View>
          ) : null}
        </View>
      }
      jobbra={
        <View style={{ alignItems: 'flex-end', gap: 4 }}>
          <Osszeg szoveg={szam(d.amountHuf)} m={16} />
          {kesz && d.fileId ? <GombM cim={P.fees.pdf} magas={36} onPress={() => void nyit(d.fileId, `${d.number}.pdf`)} /> : null}
        </View>
      }
    />
  );
}
