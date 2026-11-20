// SPEC §28.4.4 – „Mennyit kerestem?”: fent a kék sávban az idei eddigi tiszta jövedelem, alatta az egysoros magyarázat,
// hónaponként (a legújabb elöl) a maradék, a bevétel és az adó, a hónap koppintásra a négy részt mutatja; az év végi
// előrejelzés; „Hogyan számoljuk?”.
import { useState } from 'react';
import { View } from 'react-native';
import type { EarningsMonthView } from '@/_shared/api';
import { EARNINGS_TEXTS, fillPlaceholders } from '@/_shared/bekotes';
import { useKereset, useMe } from '@/api/hooks';
import { ApiHiba } from '@/api/http';
import { maiNap, nagybetu, szam } from '@/lib/format';
import { BELJEBB, NagySzam, OsszegSor, SavFej } from '@/kepernyok/k28';
import { szin } from '@/theme/tokens';
import { Lap, Sor, Szakasz } from '@/ui/alap';
import { AlsoLap, Betolt, Hiba, Kepernyo, vissza } from '@/ui/keret';
import { MiEzKor } from '@/ui/Magyarazat';
import { T } from '@/ui/T';
import { ZaroltKapu } from '@/ui/Zarolt';

function KeresetTartalom() {
  const ev = Number(maiNap().slice(0, 4));
  const q = useKereset(ev);
  const me = useMe();
  const fn = me.data?.accountant?.firstName ?? 'a könyvelőd';
  const [nyitott, setNyitott] = useState<EarningsMonthView | null>(null);
  const v = q.data;
  const utolso = v?.months[0];
  return (
    <Kepernyo
      ful="fooldal"
      fejlec={
        <SavFej
          vissza={() => vissza('/')}
          ikon="kivonat"
          cim={EARNINGS_TEXTS.screenTitle}
          nagy={v ? `kb. ${szam(Math.abs(Math.round(v.ytd.netHuf / 1000) * 1000))} Ft` : null}
          mondat={v && utolso ? fillPlaceholders(v.ytd.netHuf < 0 ? EARNINGS_TEXTS.screenSubNegative : EARNINGS_TEXTS.screenSub, { year: String(v.year), honap: utolso.label.toLocaleLowerCase('hu-HU') }) : null}
        />
      }
    >
      {q.isLoading ? (
        <Betolt />
      ) : q.error instanceof ApiHiba && q.error.status === 404 && q.error.message ? (
        // k7c2: a KATA client (or a client without a tax profile) gets the server's plain explanation – not an error
        <Lap style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
          <T m={16} lh={1.5}>
            {q.error.message}
          </T>
        </Lap>
      ) : q.error || !v ? (
        <Hiba hiba={q.error} ujra={() => void q.refetch()} />
      ) : (
        <>
          <Lap style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
            <T m={16} lh={1.45}>
              {v.line}
            </T>
            {v.refund ? (
              <T m={15} s={600} lh={1.45} c={szin.tintakekSzoveg} style={{ marginTop: 6 }}>
                {v.refund.text}
              </T>
            ) : null}
          </Lap>
          <Szakasz ikon="tepnaptar" cim="Hónaponként" jobbra={<MiEzKor kulcs="kereset_miert" cim={EARNINGS_TEXTS.howLink} />} />
          <Lap>
            {v.months.map((m, i) => (
              <Sor
                key={m.month}
                elso={i === 0}
                cim={nagybetu(m.label)}
                al={
                  <T m={15} lh={1.4} c={szin.halvany} szam>
                    {fillPlaceholders(EARNINGS_TEXTS.monthSub, { rev: szam(m.revenueHuf), taxes: szam(m.taxesHuf) })} · {EARNINGS_TEXTS.basis[m.basis]}
                    {m.note ? `\n${m.note}` : ''}
                  </T>
                }
                jobbra={
                  <T m={16} s={650} szam c={m.netHuf < 0 ? szin.veszely : szin.tinta}>
                    {szam(m.netHuf)} Ft
                  </T>
                }
                onPress={() => setNyitott(m)}
              />
            ))}
          </Lap>
          <Szakasz ikon="szamolo" cim={EARNINGS_TEXTS.projectionTitle} />
          <Lap style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
            <View style={{ paddingLeft: BELJEBB }}>
              {v.projection.reliable && v.projection.netHuf != null ? (
                <>
                  {v.projection.netHuf < 0 ? (
                    <T m={20} s={700} lh={1.3} szam>
                      {fillPlaceholders(EARNINGS_TEXTS.projectionNegative, { projNet: szam(Math.abs(v.projection.netHuf)) })}
                    </T>
                  ) : (
                    <NagySzam huf={v.projection.netHuf} elotte="kb." />
                  )}
                  <T m={15} lh={1.45} c={szin.halvany} style={{ marginTop: 2 }}>
                    {fillPlaceholders(EARNINGS_TEXTS.projectionSub, { projRev: szam(v.projection.revenueHuf ?? 0), projTaxes: szam(v.projection.taxesHuf ?? 0) })}
                  </T>
                  <T m={13.5} lh={1.4} c={szin.halvany} style={{ marginTop: 4 }}>
                    {EARNINGS_TEXTS.projectionNote}
                  </T>
                </>
              ) : (
                <T m={16} lh={1.45}>
                  {v.projection.text || EARNINGS_TEXTS.projectionNotYet}
                </T>
              )}
            </View>
          </Lap>
          <T m={13.5} lh={1.4} c={szin.halvany} style={{ marginTop: 12 }}>
            {fillPlaceholders(EARNINGS_TEXTS.disclaimer, { firstName: fn })}
          </T>
        </>
      )}
      <AlsoLap lathato={!!nyitott} bezar={() => setNyitott(null)}>
        {nyitott ? (
          <>
            <T m={20} s={700} lh={1.3} style={{ marginRight: 80 }} accessibilityRole="header">
              {nagybetu(nyitott.label)}
            </T>
            <View style={{ marginTop: 10 }}>
              <OsszegSor elso cim="Bevétel" huf={nyitott.revenueHuf} />
              <OsszegSor cim={EARNINGS_TEXTS.partSzja} huf={nyitott.parts.szjaHuf} />
              <OsszegSor cim={EARNINGS_TEXTS.partTb} huf={nyitott.parts.tbHuf} />
              <OsszegSor cim={EARNINGS_TEXTS.partSzocho} huf={nyitott.parts.szochoHuf} />
              <OsszegSor cim={EARNINGS_TEXTS.partHipa} huf={nyitott.parts.hipaHuf} />
              <OsszegSor cim="Ennyi maradt" huf={nyitott.netHuf} />
            </View>
            {nyitott.note ? (
              <T m={15} lh={1.45} c={szin.halvany} style={{ marginTop: 8 }}>
                {nyitott.note}
              </T>
            ) : null}
          </>
        ) : null}
      </AlsoLap>
    </Kepernyo>
  );
}

export default function Kereset() {
  return (
    <ZaroltKapu feature="kereset" ful="fooldal" cim={EARNINGS_TEXTS.screenTitle}>
      <KeresetTartalom />
    </ZaroltKapu>
  );
}
