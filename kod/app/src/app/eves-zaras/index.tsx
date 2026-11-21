// SPEC §28.K.3 – „Éves zárás {év}”: az állapot egy mondatban, a következő dátum, és az ügyfél következő lépésének egyetlen
// gombja (Kitöltöm / Fizetek / Átnézem és jóváhagyom). A bevallást az app nem adja be: a könyvelő, meghatalmazottként.
import { router } from 'expo-router';
import { View } from 'react-native';
import { ANNUAL_TEXTS as E, fillPlaceholders } from '@/_shared/bekotes';
import { useEvesZaras, useMe } from '@/api/hooks';
import { hibaUzenet } from '@/lib/hiba';
import { datumEvvel, maiNap } from '@/lib/format';
import { dijFizetes } from '@/lib/simplepay';
import { BELJEBB, OsszegSor, SavFej } from '@/kepernyok/k28';
import { szin } from '@/theme/tokens';
import { GombE, Lap, Szakasz } from '@/ui/alap';
import { Betolt, Hiba, Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { MiEzKor } from '@/ui/Magyarazat';
import { T } from '@/ui/T';

export default function EvesZaras() {
  const ev = Number(maiNap().slice(0, 4));
  const q = useEvesZaras(ev);
  const me = useMe();
  const fn = me.data?.accountant?.firstName ?? 'a könyvelőd';
  const jelez = useJelzes();
  const z = q.data;
  const gomb =
    z?.nextAction === 'kitoltes' ? (
      <GombE cim={E.buttons.kerdoiv} onPress={() => router.push('/eves-zaras/kerdoiv')} />
    ) : z?.nextAction === 'fizetes' && z.feeCharge ? (
      <GombE
        cim={E.buttons.dijra_var}
        onPress={async () => {
          try {
            await dijFizetes(z.feeCharge!.id);
          } catch (e) {
            jelez(hibaUzenet(e, 'Nem sikerült a fizetés. Próbáld újra.'));
          }
        }}
      />
    ) : z?.nextAction === 'jovahagyas' && z.draft ? (
      <GombE cim={E.buttons.jovahagyasra_var} onPress={() => router.push(`/tetel/${z.draft!.id}`)} />
    ) : undefined;
  return (
    <Kepernyo
      ful="fooldal"
      fejlec={<SavFej vissza={() => vissza('/')} ikon="bevallas" cim={fillPlaceholders(E.card.title, { ev: String(z?.year ?? ev - 1) })} mondat={z?.statusText ?? 'Január 5-én nyílik. Szólunk, ha kitöltheted.'} />}
      dokk={gomb}
    >
      {q.isLoading ? (
        <Betolt />
      ) : q.error ? (
        <Hiba hiba={q.error} ujra={() => void q.refetch()} />
      ) : (
        <>
          <Szakasz ikon="hataridok" cim="Határidők" jobbra={<MiEzKor kulcs="eves_zaras" />} />
          <Lap style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
            <View style={{ paddingLeft: BELJEBB }}>
              {z ? (
                <>
                  <OsszegSor elso cim="A kérdőív kitöltése" al={datumEvvel(z.questionnaireDue)} huf={null} />
                  {z.legalDue.szja ? <OsszegSor cim={`Szja-bevallás (${fn} adja be)`} al={datumEvvel(z.legalDue.szja)} huf={null} /> : null}
                  {z.legalDue.kata ? <OsszegSor cim={`Kata-nyilatkozat (${fn} adja be)`} al={datumEvvel(z.legalDue.kata)} huf={null} /> : null}
                  <OsszegSor cim="Iparűzési adó bevallása" al={datumEvvel(z.legalDue.hipa)} huf={null} />
                </>
              ) : (
                <T m={16} lh={1.45} style={{ paddingVertical: 8 }}>
                  Az éves zárás január 5-én nyílik. Akkor kérünk tőled pár választ, és {fn} elkészíti a bevallásaidat.
                </T>
              )}
            </View>
          </Lap>
          {z?.feeCharge ? (
            <>
              <Szakasz ikon="szamlaszam" cim="Díj" />
              <Lap style={{ paddingHorizontal: 16, paddingBottom: 8 }}>
                <View style={{ paddingLeft: BELJEBB }}>
                  <OsszegSor elso cim={z.feeCharge.label} al={z.feeCharge.statusText} huf={z.feeCharge.amountHuf} />
                </View>
              </Lap>
            </>
          ) : null}
          <T m={13.5} lh={1.45} c={szin.halvany} style={{ marginTop: 12 }}>
            {`A bevallásokat ${fn} adja be meghatalmazottként, a te jóváhagyásod után.`}
          </T>
        </>
      )}
    </Kepernyo>
  );
}
