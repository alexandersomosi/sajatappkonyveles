// SPEC §32.B – „Javítjuk egy beadott bevallásodat” (önellenőrzés): mit javítunk, miért, adónemenként a különbözet, az
// önellenőrzési pótlék (a könyvelő hagyta jóvá; ha az iroda állja, ezt írjuk), összesen fizetendő vagy a javadra szóló
// összeg, és a jóváhagyás megerősítéssel (a hash a látott tartalmat fedi). Beadás után a fizetési lapra visz.
import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { View } from 'react-native';
import { fillPlaceholders } from '@/_shared/bekotes';
import { EVES_TEXTS as V } from '@/_shared/eves';
import { useMe, useOnellenorzes, useOnellenorzesJovahagy } from '@/api/hooks';
import { onellEredmeny } from '@/lib/eves';
import { szam } from '@/lib/format';
import { hibaUzenet } from '@/lib/hiba';
import { BELJEBB, OsszegSor, SavFej } from '@/kepernyok/k28';
import { szin } from '@/theme/tokens';
import { GombE, GombM, GombSz, Lap, Szakasz } from '@/ui/alap';
import { AlsoLap, Betolt, Hiba, Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { T } from '@/ui/T';
import { ZaroltKapu } from '@/ui/Zarolt';

function Tartalom() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useOnellenorzes(id);
  const me = useMe();
  const fn = me.data?.accountant?.firstName ?? 'A könyvelőd';
  const jovahagy = useOnellenorzesJovahagy();
  const jelez = useJelzes();
  const [lap, setLap] = useState(false);
  const v = q.data;
  const eredmeny = v ? onellEredmeny(v) : null;
  const dokk = v?.canApprove ? (
    <GombE cim={V.onell.gomb} onPress={() => setLap(true)} />
  ) : v?.paymentPeriodId ? (
    <GombE cim={V.onell.fizetesGomb} onPress={() => router.push(`/fizetes/${v.paymentPeriodId}` as never)} />
  ) : undefined;
  return (
    <Kepernyo ful="fooldal" fejlec={<SavFej vissza={() => vissza('/eves-zaras')} ikon="irat" cim={V.onell.cim} mondat={v?.statusText ?? null} />} dokk={dokk}>
      {q.isLoading ? (
        <Betolt />
      ) : q.error || !v ? (
        <Hiba hiba={q.error} ujra={() => void q.refetch()} />
      ) : (
        <>
          <Szakasz ikon="bevallas" cim={V.onell.mit} />
          <Lap style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
            <T m={16.5} s={600} lh={1.45}>
              {v.what}
            </T>
          </Lap>
          <Szakasz ikon="kerdezek" cim={V.onell.miert} />
          <Lap style={{ paddingHorizontal: 16, paddingVertical: 14 }}>
            <T m={16} lh={1.5}>
              {v.reason}
            </T>
          </Lap>
          <Szakasz ikon="szamolo" cim="Különbözet" />
          <Lap style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <View style={{ paddingLeft: BELJEBB }}>
              {v.diffs.map((d, i) => (
                <OsszegSor key={`${d.label}-${i}`} elso={i === 0} cim={d.inFavour ? `${d.label} (${V.onell.javaradCimke})` : d.label} huf={d.amountHuf} />
              ))}
              {v.potlekHuf > 0 ? <OsszegSor cim={V.onell.potlek} al={v.potlekPaidByUs ? V.onell.potlekIroda : V.onell.potlekAl} huf={v.potlekHuf} /> : null}
              {/* javító kör 11-21 (Art. 212. § (2)): the tax was paid in full – only the pótlék is due */}
              {v.diffsAlreadyPaid ? (
                <T m={15} lh={1.45} c={szin.halvany} style={{ paddingVertical: 8 }}>
                  {V.onell.marBefizetve}
                </T>
              ) : null}
            </View>
          </Lap>
          {eredmeny ? (
            <Lap style={{ paddingHorizontal: 16, paddingVertical: 16, marginTop: 12 }}>
              <View style={{ paddingLeft: BELJEBB }}>
                {eredmeny === 'fizetendo' ? (
                  <>
                    <T m={22} s={700} lh={1.25}>
                      {fillPlaceholders(V.onell.osszesen, { osszeg: szam(v.totalHuf) })}
                    </T>
                    <T m={15.5} lh={1.45} c={szin.halvany} style={{ marginTop: 4 }}>
                      {V.onell.osszesenAl}
                    </T>
                  </>
                ) : null}
                {v.inFavourHuf > 0 ? (
                  <T m={15.5} lh={1.45} style={{ marginTop: eredmeny === 'fizetendo' ? 10 : 0 }}>
                    {fillPlaceholders(V.onell.javara, { osszeg: szam(v.inFavourHuf), firstName: fn })}
                  </T>
                ) : null}
              </View>
            </Lap>
          ) : null}
          <GombSz cim={V.onell.kerdes} style={{ alignSelf: 'flex-start', marginTop: 12, marginLeft: 4 }} onPress={() => router.push('/uzenetek')} />
        </>
      )}
      <AlsoLap lathato={lap} bezar={() => setLap(false)}>
        <T m={20} s={700} lh={1.3} style={{ paddingRight: 84 }} accessibilityRole="header">
          {fillPlaceholders(V.onell.megerosit, { firstName: fn })}
        </T>
        <GombE
          cim={V.onell.gomb}
          tolt={jovahagy.isPending}
          style={{ marginTop: 18 }}
          onPress={async () => {
            if (!v?.approvalHash) return;
            try {
              await jovahagy.mutateAsync({ id: v.id, hash: v.approvalHash });
              setLap(false);
              void q.refetch();
            } catch (e) {
              setLap(false);
              jelez(hibaUzenet(e, 'Nem sikerült. Nyisd meg újra, és nézd át.'));
              void q.refetch();
            }
          }}
        />
        <GombM cim="Mégse" style={{ marginTop: 8 }} onPress={() => setLap(false)} />
      </AlsoLap>
    </Kepernyo>
  );
}

/** SPEC §26.5: bekötés alatt zárolt (adóadat). */
export default function Onellenorzes() {
  return (
    <ZaroltKapu feature="hataridok" ful="fooldal" cim={V.onell.cim}>
      <Tartalom />
    </ZaroltKapu>
  );
}
