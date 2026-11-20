// SPEC §29.1.13 – the payment result after the hosted page (kezjegy://elofizetes/eredmeny?cs=…&cel=… natively, the same
// path on the web). The money state comes ONLY from the server: GET /client/payments/checkout/:cs is polled (≤ 30 s,
// then "Még ellenőrizzük a fizetést. Szólunk, ha kész."). An URL saying "success" decides nothing.
// A SimplePay return (?e=SUCCESS&t=…) keeps the kept SimplePay screen.
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { fillPlaceholders } from '@/_shared/bekotes';
import { PAYMENT_RULES, PAYMENT_SCREEN_TEXTS as P, type HostedCel } from '@/_shared/k29';
import { K, useConfig } from '@/api/hooks';
import { K29, useFizetesEredmeny } from '@/api/hooks-k29';
import { KG, useGuided } from '@/api/hooks-k29g';
import { datumAn, szam } from '@/lib/format';
import { SimplePayEredmeny } from '@/kepernyok/simplepay/Eredmeny';
import { szin } from '@/theme/tokens';
import { GombE, GombM, GombSz, Lap } from '@/ui/alap';
import { DemoFizetesJel } from '@/ui/DemoJel';
import { Ikon3d, KeszJel } from '@/ui/kepek';
import { CimSor, Kepernyo } from '@/ui/keret';
import { T } from '@/ui/T';
import { fizetesSzolgaltato } from '@/lib/fizetes';

export default function FizetesEredmeny() {
  const p = useLocalSearchParams<{ e?: string; eredmeny?: string; cs?: string; cel?: string; megszakitva?: string }>();
  if ((p.e || p.eredmeny) && !p.cs && !p.cel) return <SimplePayEredmeny />;
  return <StripeEredmeny cs={p.cs || null} cel={(p.cel as HostedCel) || 'elofizetes'} megszakitva={p.megszakitva === '1'} />;
}

function StripeEredmeny({ cs, cel, megszakitva }: { cs: string | null; cel: HostedCel; megszakitva: boolean }) {
  const qc = useQueryClient();
  const cfg = useConfig();
  const g = useGuided();
  const [lejart, setLejart] = useState(false);
  const r = useFizetesEredmeny(megszakitva && !cs ? null : cs, !lejart);
  const st = megszakitva && !r.data ? 'megszakitva' : (r.data?.status ?? (cs ? 'feldolgozas' : 'megszakitva'));
  useEffect(() => {
    const t = setTimeout(() => setLejart(true), PAYMENT_RULES.resultPollSeconds * 1000);
    return () => clearTimeout(t);
  }, []);
  // an unknown / foreign session id: no endless spinner – "Még ellenőrizzük…" with the way home
  useEffect(() => {
    if (r.error && !r.data) setLejart(true);
  }, [r.error, r.data]);
  useEffect(() => {
    if (st === 'feldolgozas') return;
    setLejart(true);
    // the server changed the subscription / fees: everything that shows them is reloaded
    for (const k of [K.elofizetes, K.onboarding, K.home, K.me, ['dijak'], K29.esedekes, K29.fizetesek, KG.guided, K.dijszamlak]) void qc.invalidateQueries({ queryKey: k });
  }, [st, qc]);
  const demo = !!cfg.data?.demo && fizetesSzolgaltato(cfg.data) === 'demo';
  const bekotesben = !!g.data?.inOnboarding;
  const d = r.data;
  const kartya = d?.kind === 'kartya';

  const tovabb = () => {
    if (cel === 'dij') return router.replace('/fiok/dijak');
    if (bekotesben) return router.replace({ pathname: '/bevezeto', params: { utan: 'elofizetes' } });
    if (cel === 'fizesd-ki') return router.replace('/');
    return router.replace('/fiok/elofizetes');
  };
  const ujra = () => router.replace(cel === 'dij' ? '/fiok/dijak' : cel === 'fizesd-ki' ? '/fizesd-ki' : bekotesben ? '/bekotes/elofizetes' : '/fiok/elofizetes');

  const cim = st === 'sikeres' ? (kartya ? P.result.cardSaved : P.result.successTitle) : st === 'sikertelen' ? P.result.failTitle : st === 'megszakitva' ? 'Megszakítottad' : lejart ? 'Még ellenőrizzük' : 'Ellenőrizzük a fizetést';
  return (
    <Kepernyo fejlec={<CimSor cim={cim} />} dokk={st === 'sikeres' ? <GombE cim={P.result.next} onPress={tovabb} /> : st === 'sikertelen' || st === 'megszakitva' ? <GombE cim={P.result.retry} onPress={ujra} /> : lejart ? <GombE cim="Rendben" onPress={() => router.replace(bekotesben ? '/bekotes' : '/')} /> : undefined}>
      {demo ? <DemoFizetesJel style={{ marginTop: 4 }} /> : null}
      <Lap style={{ padding: 16 }}>
        <View style={{ alignItems: 'center', marginBottom: 10, minHeight: 84, justifyContent: 'center' }}>
          {st === 'sikeres' ? <KeszJel pt={84} label="Sikeres fizetés" /> : st === 'feldolgozas' ? lejart ? <Ikon3d nev="ora" pt={72} /> : <ActivityIndicator color={szin.tintakek} size="large" /> : <Ikon3d nev="szamlaszam" pt={72} />}
        </View>
        {st === 'sikeres' ? (
          <>
            {d && d.amountHuf > 0 ? (
              <T m={17} s={600} lh={1.5} kozep>
                {`${szam(d.amountHuf)} Ft${d.cardLabel ? ` · ${d.cardLabel}` : ''}`}
              </T>
            ) : d?.cardLabel ? (
              <T m={17} s={600} lh={1.5} kozep>
                {d.cardLabel}
              </T>
            ) : null}
            {d?.nextChargeOn && d.nextChargeHuf ? (
              <T m={16} lh={1.5} c={szin.halvany} kozep style={{ marginTop: 6 }}>
                {fillPlaceholders(P.result.successNext, { datum: datumAn(d.nextChargeOn), osszeg: szam(d.nextChargeHuf) })}
              </T>
            ) : null}
            {cel !== 'dij' && !kartya ? (
              <T m={15} lh={1.5} c={szin.halvany} kozep style={{ marginTop: 6 }}>
                A számlát e-mailben is megkapod, és itt is megtalálod: Fiók → Díjak és számlák.
              </T>
            ) : null}
          </>
        ) : st === 'feldolgozas' ? (
          <T m={16} lh={1.55} kozep>
            {lejart ? P.result.waiting : 'A bankod visszaigazolását várjuk, ez pár másodperc.'}
          </T>
        ) : st === 'sikertelen' ? (
          <>
            <T m={16} lh={1.55} kozep>
              {d?.message ?? 'A bankod nem engedte a fizetést. Nem vontunk le semmit.'}
            </T>
            <GombM cim={P.result.otherCard} onPress={ujra} style={{ alignSelf: 'center', marginTop: 14 }} />
          </>
        ) : (
          <T m={16} lh={1.55} kozep>
            {P.result.cancelled}
          </T>
        )}
        {st !== 'sikeres' ? <GombSz cim={bekotesben ? 'Vissza a Főoldalra' : 'A Fiók oldalra'} onPress={() => router.replace(bekotesben ? '/bekotes' : '/fiok')} style={{ alignSelf: 'center', marginTop: 8 }} /> : null}
      </Lap>
    </Kepernyo>
  );
}
