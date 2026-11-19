// Díjszámlák (FUNKCIOK 3, 19): a havidíjról kiállított számlák; DEMO módban „DEMO DÍJBEKÉRŐ – NEM SZÁMLA”.
import { useDijszamlak } from '@/api/hooks';
import { fajlMegnyit } from '@/lib/fajlok';
import { datumEvvel, szam } from '@/lib/format';
import { szin } from '@/theme/tokens';
import { Allapot, Lap, Osszeg, Sor } from '@/ui/alap';
import { Betolt, CimSor, Hiba, Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { T } from '@/ui/T';
import { hibaUzenet } from '@/lib/hiba';

export default function Dijszamlak() {
  const q = useDijszamlak();
  const jelez = useJelzes();
  const lista = q.data?.items ?? [];
  const demo = lista.some((x) => x.demo);
  return (
    <Kepernyo ful="fiok" fejlec={<CimSor visszaCim="Vissza a fiókhoz" vissza={() => vissza('/fiok')} cim="Díjszámlák" al={demo ? 'DEMO: ezek díjbekérők, nem valódi számlák.' : 'Minden levonás után automatikusan.'} />}>
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
