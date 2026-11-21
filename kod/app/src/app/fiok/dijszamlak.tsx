// Díjszámlák (FUNKCIOK 3, 19): a havidíjról kiállított számlák; DEMO módban „DEMO DÍJBEKÉRŐ – NEM SZÁMLA”.
// k8 ALAP-B: átutalásnál a díjbekérők a lista tetején (nyitott: utalási adatokkal). Előtte: kod/app/_regi/elotte_k8_B/src/app/fiok/dijszamlak.tsx
import { useDijszamlak } from '@/api/hooks';
import { useSzamlazas } from '@/api/hooks-k8';
import { TRANSFER_TEXTS } from '@/_shared/k8';
import { UtalasiAdatok } from '@/kepernyok/Atutalas';
import { Cimke, Szakasz } from '@/ui/alap';
import { fajlMegnyit } from '@/lib/fajlok';
import { datumEvvel, szam } from '@/lib/format';
import { szin } from '@/theme/tokens';
import { Allapot, Lap, Osszeg, Sor } from '@/ui/alap';
import { Betolt, CimSor, Hiba, Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { T } from '@/ui/T';
import { View } from 'react-native';
import { hibaUzenet } from '@/lib/hiba';

export default function Dijszamlak() {
  const q = useDijszamlak();
  const sz = useSzamlazas();
  const jelez = useJelzes();
  const lista = q.data?.items ?? [];
  const demo = lista.some((x) => x.demo);
  const bekerok = sz.data ? [...sz.data.open, ...sz.data.recent] : [];
  return (
    <Kepernyo ful="fiok" fejlec={<CimSor visszaCim="Vissza a fiókhoz" vissza={() => vissza('/fiok')} cim="Díjszámlák" al={demo ? 'DEMO: ezek bemutató számlák, nem valódiak.' : 'Minden fizetés után automatikusan.'} />}>
      {bekerok.length ? (
        <>
          <Szakasz ikon="szamlaszam" cim={TRANSFER_TEXTS.proformaListTitle} megj={TRANSFER_TEXTS.invoiceAfterTransfer} />
          <Lap style={{ paddingHorizontal: 16, paddingBottom: 12 }}>
            {bekerok.map((d, i) => (
              <View key={d.id} style={{ paddingTop: i ? 14 : 4 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <T m={16} s={650} style={{ flex: 1 }}>
                    {d.proformaNumber ?? d.orderNo} · {szam(d.amountHuf)} Ft
                  </T>
                  <Cimke szoveg={d.statusLabel} veszely={d.status === 'kesik'} />
                </View>
                <T m={14.5} c={szin.halvany}>
                  {d.paidOn ? `Fizetve: ${datumEvvel(d.paidOn)}` : `Határidő: ${datumEvvel(d.dueOn)}`}
                </T>
                {d.payTo ? <UtalasiAdatok d={d} mod={sz.data!.kozlemenyMode} /> : null}
              </View>
            ))}
          </Lap>
        </>
      ) : null}
      {q.isLoading ? <Betolt /> : q.error ? <Hiba hiba={q.error} ujra={() => void q.refetch()} /> : lista.length ? (
        <Lap>
          {lista.map((d, i) => (
            <Sor
              key={d.id}
              elso={i === 0}
              ikon="irat"
              cim={d.number}
              al={<Allapot szo={datumEvvel(d.issuedOn)} utana={d.demo ? 'DEMO, nem számla' : undefined} />}
              jobbra={<Osszeg szoveg={szam(d.amountHuf)} m={16} />}
              onPress={() => fajlMegnyit(d.fileId, `${d.number}.pdf`).catch((e: unknown) => jelez(hibaUzenet(e, 'Nem sikerült. Próbáld újra.')))}
            />
          ))}
        </Lap>
      ) : (
        <Lap style={{ padding: 18 }}>
          <T m={15.5} c={szin.halvany}>
            Még nincs díjszámlád.
          </T>
        </Lap>
      )}
    </Kepernyo>
  );
}
