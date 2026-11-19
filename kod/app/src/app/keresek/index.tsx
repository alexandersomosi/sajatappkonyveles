// Kérések mindkét irányban (FUNKCIOK 11, 17): amit a könyvelő kér tőled, és amit te kértél; állapottal.
import { View } from 'react-native';
import { router } from 'expo-router';
import type { RequestSummary } from '@/_shared/api';
import { ApiHiba } from '@/api/http';
import { useHome, useKeresek, useKeresKesz, useKeresVisszavon } from '@/api/hooks';
import { datumIg, datumRovid, mikor, nagybetu } from '@/lib/format';
import { szin } from '@/theme/tokens';
import { Allapot, GombM, GombSz, Lap, Sor, Szakasz } from '@/ui/alap';
import { ma } from '@/ui/ido';
import { Targykep } from '@/ui/kepek';
import { Betolt, CimSor, Hiba, Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { T } from '@/ui/T';
import { useHozzaferes, useZarolt } from '@/ui/Zarolt';
import { hibaUzenet } from '@/lib/hiba';

export default function Keresek() {
  const q = useKeresek();
  const home = useHome();
  const visszavon = useKeresVisszavon();
  const keszre = useKeresKesz();
  const jelez = useJelzes();
  const hf = useHozzaferes();
  const zarolt = useZarolt();
  // SPEC §26.5.2: bekötés alatt csak kérdés küldhető; az igazolás- és adatváltozás-kérés lakattal, okkal.
  const igazolasZarva = hf.zarva('igazolas_keres');
  const fn = home.data?.accountant.firstName ?? 'A könyvelőd';
  const lista = q.data?.items ?? [];
  const tole = lista.filter((k) => k.direction === 'konyvelotol');
  const tolem = lista.filter((k) => k.direction === 'ugyfeltol');
  const nap = ma();
  const nyitott = (k: RequestSummary) => k.status === 'nyitott' || k.status === 'folyamatban';

  return (
    <Kepernyo ful="fooldal" fejlec={<CimSor visszaCim="Vissza" vissza={() => vissza('/')} cim="Kérések" al={`Amit ${fn} kér tőled, és amit te kértél tőle.`} />}>
      {q.isLoading ? <Betolt /> : q.error ? <Hiba hiba={q.error} ujra={() => void q.refetch()} /> : (
        <>
          <Szakasz cim={`${fn} kéri`} style={{ paddingTop: 6 }} />
          {tole.length ? (
            <Lap>
              {tole.map((k, i) => {
                const lejart = nyitott(k) && !!k.dueDate && k.dueDate < nap;
                const elkuldve = k.status === 'teljesitve';
                return (
                  <View key={k.id}>
                    <Sor
                      elso={i === 0}
                      ikon="feltoltes"
                      kesz={elkuldve}
                      cim={k.title}
                      al={
                        <Allapot
                          szo={nyitott(k) ? (lejart ? 'Lejárt' : k.dueDate ? nagybetu(datumIg(k.dueDate)) : 'Nyitott') : elkuldve ? 'Elküldted' : k.statusLabel}
                          utana={nyitott(k) ? (lejart ? `a határidő ${datumRovid(k.dueDate!)} volt` : k.body.split('.')[0]) : elkuldve ? ((k as { completedAt?: string }).completedAt ? `${fn} megkapta, ${mikor((k as { completedAt?: string }).completedAt!, nap)}` : `${fn} megkapta`) : mikor(k.createdAt, nap)}
                          kesz={elkuldve}
                          veszely={lejart}
                        />
                      }
                      onPress={nyitott(k) && k.type === 'dokumentum' ? () => router.push({ pathname: '/feltoltes', params: { keres: k.id, kategoria: /kivonat/i.test(k.title) ? 'bankszamlakivonat' : 'egyeb', honap: k.dossierMonth ?? '' } }) : () => router.push('/uzenetek')}
                    />
                    {nyitott(k) ? (
                      <GombSz
                        cim={keszre.isPending && keszre.variables?.id === k.id ? 'Egy pillanat…' : 'Kész, elküldtem'}
                        m={14.5}
                        style={{ marginLeft: 73, marginTop: -8, marginBottom: 4 }}
                        onPress={async () => {
                          try {
                            await keszre.mutateAsync({ id: k.id });
                            jelez({ szoveg: `Lezártad. ${fn} látja, hogy elküldted.`, kesz: true });
                          } catch (e) {
                            jelez(hibaUzenet(e, 'Nem sikerült.'));
                          }
                        }}
                      />
                    ) : null}
                  </View>
                );
              })}
            </Lap>
          ) : (
            <Lap style={{ padding: 18 }}>
              <T m={15.5} c={szin.halvany}>
                Most nem kér tőled semmit.
              </T>
            </Lap>
          )}
          <Szakasz cim="Amit te kértél" />
          {tolem.length ? (
            <Lap>
              {tolem.map((k, i) => (
                <View key={k.id}>
                  <Sor
                    elso={i === 0}
                    ikon={k.certificate ? 'igazolas' : k.type === 'kerdes' ? 'kerdezek' : 'fiok'}
                    kesz={k.status === 'teljesitve'}
                    cim={k.title}
                    al={<Allapot szo={k.statusLabel.split(',')[0]} utana={k.statusLabel.includes(',') ? k.statusLabel.split(',').slice(1).join(',').trim() : mikor(k.createdAt, nap)} kesz={k.status === 'teljesitve'} />}
                    onPress={k.resultDocumentId ? () => router.push(`/tetel/${k.resultDocumentId}`) : undefined}
                  />
                  {k.status === 'nyitott' ? (
                    <GombSz
                      cim="Visszavonom"
                      m={14.5}
                      style={{ marginLeft: 73, marginTop: -8, marginBottom: 4 }}
                      onPress={async () => {
                        try {
                          await visszavon.mutateAsync(k.id);
                          jelez('Visszavontad a kérést.');
                        } catch (e) {
                          jelez(hibaUzenet(e, 'Nem sikerült.'));
                        }
                      }}
                    />
                  ) : null}
                </View>
              ))}
            </Lap>
          ) : (
            <Lap style={{ padding: 18, alignItems: 'center' }}>
              <Targykep nev="level_boritek" style={{ marginBottom: 8 }} />
              <T m={15.5} c={szin.halvany} kozep lh={1.5}>
                Még nem kértél semmit. Igazolást egy gombnyomással kérhetsz.
              </T>
            </Lap>
          )}
          {igazolasZarva ? (
            <>
              <GombM cim="Kérdésem van" ikon="kerdezek" onPress={() => router.push({ pathname: '/keresek/uj', params: { tipus: 'kerdes' } })} style={{ marginTop: 16 }} />
              <GombM
                cim="Igazolás kérése – a bekötés után"
                ikon="lakat"
                accessibilityState={{ disabled: true }}
                accessibilityHint={hf.ok('igazolas_keres') ?? undefined}
                onPress={() => zarolt({ feature: 'igazolas_keres' })}
                style={{ marginTop: 10, opacity: 0.85 }}
              />
            </>
          ) : (
            <GombM cim="Új kérés" ikon="igazolas" onPress={() => router.push('/keresek/uj')} style={{ marginTop: 16 }} />
          )}
        </>
      )}
    </Kepernyo>
  );
}
