// A hónap kiállított számlái a NAV Online Számlából (FUNKCIOK 12). Csak olvasható; demóban MINTA jelzéssel.
import { View } from 'react-native';
import { fillPlaceholders, INVOICE_WORDING } from '@/_shared/bekotes';
import { router, useLocalSearchParams } from 'expo-router';
import { useNavSzamlak } from '@/api/hooks';
import { datum, honapMelleknev, szam } from '@/lib/format';
import { szin } from '@/theme/tokens';
import { Allapot, Lap, Osszeg, Sor } from '@/ui/alap';
import { Betolt, CimSor, Hiba, Kepernyo, vissza } from '@/ui/keret';
import { T } from '@/ui/T';
import { ZaroltKapu } from '@/ui/Zarolt';

function SzamlakTartalom() {
  const { honap } = useLocalSearchParams<{ honap: string }>();
  const q = useNavSzamlak(honap);
  const lista = q.data?.items ?? [];
  const ossz = lista.reduce((a, b) => a + b.grossAmountHuf, 0);
  const nev = honapMelleknev(honap);
  return (
    <Kepernyo
      ful="dosszie"
      fejlec={
        <CimSor
          visszaCim={`Vissza ${/^[aáeéiíoóöőuúüű]/.test(nev) ? 'az' : 'a'} ${nev} dossziéhoz`}
          vissza={() => vissza(`/dosszie?honap=${honap}`)}
          cim={INVOICE_WORDING.sectionTitle}
          al={lista.length ? fillPlaceholders(INVOICE_WORDING.monthSub, { n: String(lista.length), sum: szam(ossz) }) : INVOICE_WORDING.short}
        />
      }
    >
      {q.isLoading ? <Betolt /> : q.error ? <Hiba hiba={q.error} ujra={() => void q.refetch()} /> : (
        <Lap>
          {lista.length ? (
            lista.map((s, i) => (
              <Sor
                key={s.id}
                elso={i === 0}
                ikon="szamlak"
                kesz={s.status === 'feldolgozva' || s.status === 'beadva'}
                cim={s.customerName?.trim() || 'Magánszemély'}
                al={<Allapot szo={s.invoiceNumber} utana={`${datum(s.issueDate)}${s.demo ? ' · MINTA' : ''}`} />}
                jobbra={<Osszeg szoveg={szam(s.grossAmountHuf)} m={16} />}
                onPress={() => router.push(`/szamla/${s.id}`)}
              />
            ))
          ) : (
            <View style={{ padding: 18 }}>
              <T m={15.5} c={szin.halvany} lh={1.5}>
                {INVOICE_WORDING.monthEmpty}
              </T>
            </View>
          )}
        </Lap>
      )}
    </Kepernyo>
  );
}

/** SPEC §26.5: bekötés alatt zárolt képernyő. */
export default function Szamlak() {
  return (
    <ZaroltKapu feature="nav_szamlak" ful="dosszie" cim="Számlák">
      <SzamlakTartalom />
    </ZaroltKapu>
  );
}
