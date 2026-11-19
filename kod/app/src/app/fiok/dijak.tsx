// SPEC §28.K.1 – „Díjak és számlák” (a régi „Díjszámlák” helyett): mi van a havidíjban (egy sor), a külön díjak táblája
// (a még nem véglegesített összeg mellett DEMO jel), a fizetésre váró díjak „Fizetek” gombbal, a kifizetettek, és a
// díjszámlák. Meglepetés-díj nincs: minden díj itt látszik, mielőtt kártyát kérnénk (SPEC §28.K.12 #8).
import { useEffect } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { FEE_TEXTS, FEE_UNIT_LABELS, fillPlaceholders } from '@/_shared/bekotes';
import { useDijak, useDijszamlak } from '@/api/hooks';
import { fajlMegnyit } from '@/lib/fajlok';
import { hibaUzenet } from '@/lib/hiba';
import { datumEvvel, szam } from '@/lib/format';
import { dijFizetes } from '@/lib/simplepay';
import { DemoDij } from '@/kepernyok/k28';
import { szin } from '@/theme/tokens';
import { Allapot, GombE, GombM, Lap, Osszeg, Sor, Szakasz } from '@/ui/alap';
import { Betolt, CimSor, Hiba, Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { T } from '@/ui/T';

export default function Dijak() {
  const p = useLocalSearchParams<{ fizetve?: string; o?: string }>();
  const q = useDijak();
  const szamlak = useDijszamlak();
  const jelez = useJelzes();
  const v = q.data;
  useEffect(() => {
    // visszatérés a fizetésből: a szerver szerinti állapotot töltjük újra
    if (p.fizetve || p.o) void q.refetch();
  }, [p.fizetve, p.o]); // eslint-disable-line react-hooks/exhaustive-deps
  const fizet = async (id: string) => {
    try {
      await dijFizetes(id);
    } catch (e) {
      jelez(hibaUzenet(e, FEE_TEXTS.payFailed));
    }
  };
  const elso = v?.open[0];
  const lista = szamlak.data?.items ?? [];
  return (
    <Kepernyo
      ful="fiok"
      fejlec={<CimSor visszaCim="Vissza a Fiókhoz" vissza={() => vissza('/fiok')} cim={FEE_TEXTS.screenTitle} al={v?.inPlan ?? FEE_TEXTS.inPlan} />}
      dokk={elso ? <GombE cim={fillPlaceholders(FEE_TEXTS.payButtonAmount, { dij: szam(elso.amountHuf) })} onPress={() => void fizet(elso.id)} /> : undefined}
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
                    al={d.purpose.type === 'eves_zaras' ? 'A fizetés után Bence nekilát az éves zárásnak.' : 'A fizetés után nekilátunk a bejelentésnek.'}
                    jobbra={
                      <View style={{ alignItems: 'flex-end', gap: 4 }}>
                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <Osszeg szoveg={szam(d.amountHuf)} m={16} />
                          {d.demo ? <DemoDij /> : null}
                        </View>
                        {i > 0 && d.canPay ? <GombM cim={FEE_TEXTS.payButton} onPress={() => void fizet(d.id)} /> : null}
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
                al={t.line}
                jobbra={
                  <View style={{ alignItems: 'flex-end' }}>
                    <T m={16} s={650} szam>
                      {szam(t.amountHuf)} Ft
                    </T>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <T m={13.5} c={szin.halvany}>
                        {FEE_UNIT_LABELS[t.unit]}
                      </T>
                      {t.demo ? <DemoDij /> : null}
                    </View>
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
          <Szakasz ikon="irat" cim={FEE_TEXTS.invoicesTitle} megj={lista.some((x) => x.demo) ? 'DEMO: ezek díjbekérők, nem valódi számlák.' : undefined} />
          <Lap>
            {lista.length ? (
              lista.map((d, i) => (
                <Sor
                  key={d.id}
                  elso={i === 0}
                  cim={d.number}
                  al={<Allapot szo={datumEvvel(d.issuedOn)} utana={d.demo ? 'DEMO, nem számla' : undefined} m={15} />}
                  jobbra={<Osszeg szoveg={szam(d.amountHuf)} m={16} />}
                  onPress={() => fajlMegnyit(d.fileId, `${d.number}.pdf`).catch((e: unknown) => jelez(hibaUzenet(e, 'Nem sikerült. Próbáld újra.')))}
                />
              ))
            ) : (
              <T m={16} c={szin.halvany} style={{ padding: 16 }}>
                Még nincs díjszámlád.
              </T>
            )}
          </Lap>
        </>
      )}
    </Kepernyo>
  );
}
