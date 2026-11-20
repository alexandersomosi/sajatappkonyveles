// SPEC §29.5 F1 – „Igazolások”: a kért igazolások állapottal; a kész igazolás innen letölthető. Fő gomb: „Igazolást kérek”.
import { router } from 'expo-router';
import { View } from 'react-native';
import { CERT_FORM_TEXTS, CERT_OPEN_STATUSES } from '@/_shared/k29f';
import { fillPlaceholders } from '@/_shared/bekotes';
import { useIgazolasok } from '@/api/k29f';
import { useHome } from '@/api/hooks';
import { IgazolasAllapot } from '@/kepernyok/k29f';
import { szin } from '@/theme/tokens';
import { GombE, Lap, Sor, Szakasz } from '@/ui/alap';
import { Targykep } from '@/ui/kepek';
import { Betolt, CimSor, Hiba, Kepernyo, vissza } from '@/ui/keret';
import { T } from '@/ui/T';

export default function Igazolasok() {
  const q = useIgazolasok();
  const home = useHome();
  const fn = home.data?.accountant.firstName ?? 'A könyvelőd';
  const lista = q.data?.items ?? [];
  const nyitott = lista.filter((x) => CERT_OPEN_STATUSES.includes(x.status));
  const tobbi = lista.filter((x) => !CERT_OPEN_STATUSES.includes(x.status));
  return (
    <Kepernyo
      ful="fooldal"
      fejlec={<CimSor visszaCim="Vissza" vissza={() => vissza('/')} cim={CERT_FORM_TEXTS.listTitle} al={fillPlaceholders(CERT_FORM_TEXTS.listSub, { firstName: fn })} />}
      dokk={<GombE cim={CERT_FORM_TEXTS.newButton} onPress={() => router.push('/igazolas/uj')} />}
    >
      {q.isLoading ? (
        <Betolt />
      ) : q.error ? (
        <Hiba hiba={q.error} ujra={() => void q.refetch()} />
      ) : !lista.length ? (
        <Lap style={{ padding: 18, alignItems: 'center' }}>
          <Targykep nev="ures_mappa" style={{ marginBottom: 8 }} />
          <T m={17} s={650} kozep>
            {CERT_FORM_TEXTS.listEmpty}
          </T>
          <T m={15} c={szin.halvany} lh={1.45} kozep style={{ marginTop: 6 }}>
            Jövedelemigazolás, adóigazolás, KOMA, nyilvántartási kivonat – a NAV ingyen adja.
          </T>
        </Lap>
      ) : (
        <>
          {nyitott.length ? (
            <>
              <Szakasz ikon="ora" cim="Folyamatban" />
              <Lap>
                {nyitott.map((v, i) => (
                  <Sor key={v.id} elso={i === 0} ikon="igazolas" cim={v.title} al={<IgazolasAllapot v={v} />} onPress={() => router.push(`/igazolas/${v.id}`)} />
                ))}
              </Lap>
            </>
          ) : null}
          {tobbi.length ? (
            <>
              <Szakasz ikon="dosszie" cim="Lezárt kérések" />
              <Lap>
                {tobbi.map((v, i) => (
                  <Sor key={v.id} elso={i === 0} ikon="igazolas" cim={v.title} al={<IgazolasAllapot v={v} />} onPress={() => router.push(`/igazolas/${v.id}`)} />
                ))}
              </Lap>
            </>
          ) : null}
          <View style={{ height: 8 }} />
        </>
      )}
    </Kepernyo>
  );
}
