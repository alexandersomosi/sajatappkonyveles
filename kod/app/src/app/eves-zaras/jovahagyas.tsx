// SPEC §32.B – „Nézd át a bevallásodat”: a könyvelő által a bevallásból beírt számok (bevétel, jövedelem, szja, a befizetett
// előlegek negyedévenként, a különbözet; katánál keret és különadó), a járulékok és az iparűzési adó tájékoztatásul, fizetendőnél
// az utalási adatok, és a jóváhagyás megerősítéssel. A jóváhagyás a tervezetet ÉS a számokat fedi: ha a könyvelő közben
// módosít, újra át kell nézni. Az app nem ad be és nem utal.
import { useState } from 'react';
import { router } from 'expo-router';
import { View } from 'react-native';
import { fillPlaceholders } from '@/_shared/bekotes';
import { EVES_TEXTS as V } from '@/_shared/eves';
import { useEvesJovahagy, useEvesZaras, useMe } from '@/api/hooks';
import { jovahagyhato, osszegSor } from '@/lib/eves';
import { datum, datumIg } from '@/lib/format';
import { hibaUzenet } from '@/lib/hiba';
import { BELJEBB, OsszegSor, SavFej } from '@/kepernyok/k28';
import { szin } from '@/theme/tokens';
import { GombE, GombM, GombSz, Lap, Szakasz } from '@/ui/alap';
import { AlsoLap, Betolt, Hiba, Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { T } from '@/ui/T';
import type { AnnualSummaryLine } from '@/_shared/eves';

function Sorok({ sorok }: { sorok: AnnualSummaryLine[] }) {
  return (
    <>
      {sorok.map((l, i) => {
        const s = osszegSor(l);
        return <OsszegSor key={`${l.label}-${i}`} elso={i === 0} cim={s.elotte ? `${s.elotte} ${s.cim}` : s.cim} al={s.al} huf={s.huf} />;
      })}
    </>
  );
}

export default function EvesJovahagyas() {
  const q = useEvesZaras();
  const me = useMe();
  const fn = me.data?.accountant?.firstName ?? 'A könyvelőd';
  const jovahagy = useEvesJovahagy();
  const jelez = useJelzes();
  const [lap, setLap] = useState(false);
  const z = q.data;
  const s = z?.summary ?? null;
  const kata = z?.regime === 'kata';
  const mehet = z ? jovahagyhato(z) : false;
  const dokk = mehet ? <GombE cim={kata ? V.osszesito.kata.gomb : V.osszesito.gomb} onPress={() => setLap(true)} /> : undefined;
  const mondat = z?.approval ? fillPlaceholders(V.osszesito.jovahagyva, { datum: datum(z.approval.at.slice(0, 10)), firstName: fn }) : s?.formLabel ?? null;
  return (
    <Kepernyo ful="fooldal" fejlec={<SavFej vissza={() => vissza('/eves-zaras')} ikon="bevallas" cim={V.osszesito.cim} mondat={mondat} />} dokk={dokk}>
      {q.isLoading ? (
        <Betolt />
      ) : q.error ? (
        <Hiba hiba={q.error} ujra={() => void q.refetch()} />
      ) : !s ? (
        // an older draft without the numbers: the document itself is what the client approves
        <>
          <T m={16} lh={1.45}>
            {z?.draft ? 'Nézd át a tervezetet, és ha minden rendben, hagyd jóvá.' : `${fn} még nem töltötte fel a tervezetet. Amint kész, itt látod.`}
          </T>
          {z?.draft ? <GombSz cim={V.osszesito.tervezet} style={{ alignSelf: 'flex-start', marginTop: 12 }} onPress={() => router.push(`/tetel/${z.draft!.id}` as never)} /> : null}
        </>
      ) : (
        <>
          {s.letter ? (
            <>
              <Szakasz ikon="uzenetek" cim={fillPlaceholders(V.osszesito.uzenetCim, { firstName: fn })} />
              <Lap style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
                <T m={16} lh={1.5}>
                  {s.letter}
                </T>
              </Lap>
            </>
          ) : null}
          <Szakasz ikon="szamolo" cim={kata ? s.formLabel : V.osszesito.bevetelCim} />
          <Lap style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <View style={{ paddingLeft: BELJEBB }}>
              <Sorok sorok={s.income} />
            </View>
          </Lap>
          {s.szja.length ? (
            <>
              <Szakasz ikon="bevallas" cim={V.osszesito.szjaCim} />
              <Lap style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
                <View style={{ paddingLeft: BELJEBB }}>
                  <Sorok sorok={s.szja} />
                  {s.advancesByQuarter.map((a, i) => (
                    <OsszegSor key={a.label} elso={false} cim={`${a.label} – ${V.osszesito.elolegAllapot[a.state]}`} huf={a.amountHuf} al={i === 0 ? V.osszesito.eloleg : null} />
                  ))}
                </View>
              </Lap>
            </>
          ) : null}
          <Lap style={{ paddingHorizontal: 16, paddingVertical: 16, marginTop: 12 }}>
            <View style={{ paddingLeft: BELJEBB }}>
              <T m={22} s={700} lh={1.25}>
                {s.result.title}
              </T>
              <T m={15.5} lh={1.45} c={szin.halvany} style={{ marginTop: 4 }}>
                {s.result.sub}
              </T>
            </View>
          </Lap>
          {s.contributions ? (
            <>
              <Szakasz ikon="szamlak" cim={V.osszesito.jarulekCim} />
              <Lap style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
                <View style={{ paddingLeft: BELJEBB }}>
                  <Sorok sorok={s.contributions.lines} />
                  <T m={14.5} lh={1.45} c={szin.halvany} style={{ paddingVertical: 8 }}>
                    {s.contributions.text}
                  </T>
                </View>
              </Lap>
            </>
          ) : null}
          {s.hipa ? (
            <>
              <Szakasz ikon="szamlaszam" cim={V.osszesito.hipaCim} />
              <Lap style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
                <View style={{ paddingLeft: BELJEBB }}>
                  <Sorok sorok={s.hipa.lines} />
                  <T m={14.5} lh={1.45} c={szin.halvany} style={{ paddingVertical: 8 }}>
                    {s.hipa.text}
                  </T>
                </View>
              </Lap>
            </>
          ) : null}
          {s.payment ? (
            <>
              <Szakasz ikon="szamlaszam" cim={V.osszesito.utalasCim} />
              <Lap style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
                <View style={{ paddingLeft: BELJEBB }}>
                  <OsszegSor elso cim="Kedvezményezett" al={s.payment.accountName} huf={null} />
                  <OsszegSor cim="Számlaszám" al={s.payment.accountNumber} huf={null} />
                  <OsszegSor cim="Közlemény" al={s.payment.reference || '–'} huf={null} />
                  <OsszegSor cim={`Összeg, ${datumIg(s.payment.dueDate)}`} huf={s.payment.amountHuf} />
                  <T m={14.5} lh={1.45} c={szin.halvany} style={{ paddingVertical: 8 }}>
                    {V.osszesito.utalasAl}
                  </T>
                </View>
              </Lap>
            </>
          ) : null}
          {z?.draft ? <GombSz cim={V.osszesito.tervezet} style={{ alignSelf: 'flex-start', marginTop: 12, marginLeft: 4 }} onPress={() => router.push(`/tetel/${z.draft!.id}` as never)} /> : null}
          <GombSz cim={V.osszesito.kerdes} style={{ alignSelf: 'flex-start', marginTop: 4, marginLeft: 4 }} onPress={() => router.push('/uzenetek')} />
          <T m={13.5} lh={1.45} c={szin.halvany} style={{ marginTop: 12 }}>
            {s.footer}
          </T>
        </>
      )}
      <AlsoLap lathato={lap} bezar={() => setLap(false)}>
        <T m={20} s={700} lh={1.3} style={{ paddingRight: 84 }} accessibilityRole="header">
          {fillPlaceholders(kata ? V.osszesito.kata.megerosit : V.osszesito.megerosit, { firstName: fn })}
        </T>
        <GombE
          cim={V.osszesito.megerositGomb}
          tolt={jovahagy.isPending}
          style={{ marginTop: 18 }}
          onPress={async () => {
            if (!z?.approvalHash) return;
            try {
              await jovahagy.mutateAsync({ id: z.id, hash: z.approvalHash });
              setLap(false);
              jelez({ szoveg: fillPlaceholders('Köszönjük! {firstName} beadja, és szól.', { firstName: fn }), kesz: true });
              router.replace('/eves-zaras');
            } catch (e) {
              setLap(false);
              jelez(hibaUzenet(e, 'Nem sikerült. Nyisd meg újra, és nézd át.'));
              void q.refetch();
            }
          }}
        />
        <GombM cim={V.osszesito.megse} style={{ marginTop: 8 }} onPress={() => setLap(false)} />
      </AlsoLap>
    </Kepernyo>
  );
}
