// SPEC §29.1.12: the SimplePay variant of this screen, kept for PAYMENT_PROVIDER=simplepay (never deleted, off by default).
// Moved here unchanged from the route file in k7 (B3); the route now shows the Stripe / DEMO screen.
// Előfizetés kezelése (FUNKCIOK 19, SPEC §9.6): állapot, következő levonás, kártya, „Kártya cseréje”, „Kártya
// törlése” (feltétel nélkül, a SimplePay szabálya), lemondás és visszavonása; DEMO jelzés.
// A kártyacsere / folytatás / újraindítás külön ág: a SimplePay a kártyát fizetéssel menti, ezért mindig a
// KÖVETKEZŐ, még ki nem fizetett hónapot fizeti (nextPaidPeriodStart) – ugyanazt a napot sosem kétszer.
// Megerősítés: saját alsó lap (C2), nem a böngésző confirm-ablaka.
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { ApiHiba } from '@/api/http';
import { useElofizetes, useElofizetesFolytat, useElofizetesLemond, useKartyaTorles } from '@/api/hooks';
import { datum, datumEvvel, datumEvvelIg, datumIg, maiNap, nagybetu, szam } from '@/lib/format';
import { kartyasFizetes } from '@/lib/simplepay';
import { szin } from '@/theme/tokens';
import { GombE, GombM, GombSz, HibaSzoveg, Lap, Szakasz, jelzoDoboz } from '@/ui/alap';
import { AlsoLap, Betolt, CimSor, Hiba, Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { T } from '@/ui/T';
import { szoveg, szovegLista } from '@/lib/szovegek';
import { DemoFizetesJel } from '@/ui/DemoJel';
import { hibaUzenet } from '@/lib/hiba';

function Sor2({ cim, ertek, elso }: { cim: string; ertek: string; elso?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 14, paddingVertical: 12, paddingHorizontal: 18, borderTopWidth: elso ? 0 : 1, borderTopColor: szin.hajszal }}>
      <T m={15} c={szin.halvany}>
        {cim}
      </T>
      <T m={15.5} jobb style={{ flexShrink: 1 }}>
        {ertek}
      </T>
    </View>
  );
}

type Kerdes = { cim: string; szoveg: string[]; gomb: string; veszely?: boolean; tenni: () => Promise<void> };

/** A fizetett hónap két vége: "december 18.–január 18." */
function honapSav(kezd: string): string {
  const [e, h, n] = kezd.slice(0, 10).split('-').map(Number) as [number, number, number];
  const kov = new Date(Date.UTC(e, h, 1)); // a következő hónap 1-je (h 1-alapú)
  const utolso = new Date(Date.UTC(kov.getUTCFullYear(), kov.getUTCMonth() + 1, 0)).getUTCDate();
  const vege = `${kov.getUTCFullYear()}-${String(kov.getUTCMonth() + 1).padStart(2, '0')}-${String(Math.min(n, utolso)).padStart(2, '0')}`;
  return `${datum(kezd)}–${datum(vege)}`;
}

export function SimplePayKezeles() {
  // a webes SimplePay-visszatérés ide érkezik: /fiok/elofizetes?eredmeny=SUCCESS&t=… (SPEC §9.5)
  const p = useLocalSearchParams<{ eredmeny?: string; t?: string }>();
  useEffect(() => {
    if (p.eredmeny) router.replace({ pathname: '/elofizetes/eredmeny', params: { e: p.eredmeny, t: p.t ?? '' } });
  }, [p.eredmeny, p.t]);
  const q = useElofizetes();
  const lemond = useElofizetesLemond();
  const folytat = useElofizetesFolytat();
  const torol = useKartyaTorles();
  const jelez = useJelzes();
  const [hiba, setHiba] = useState<string | null>(null);
  const [tolt, setTolt] = useState(false);
  const [kerdes, setKerdes] = useState<Kerdes | null>(null);
  const [dolgozik, setDolgozik] = useState(false);
  const e = q.data;
  const ertekek = {
    'elofizetes.idoszak_vege_ig': e?.currentPeriodEnd ? datumEvvelIg(e.currentPeriodEnd) : 'A hónap végéig',
    'konyvelo.keresztnev': 'a könyvelőd',
  };

  async function fizetes(purpose: 'subscribe' | 'card_update') {
    setHiba(null);
    setTolt(true);
    try {
      await kartyasFizetes(purpose);
    } catch (x) {
      setHiba(hibaUzenet(x, 'Nem sikerült elindítani.'));
    } finally {
      setTolt(false);
    }
  }

  async function igen() {
    if (!kerdes) return;
    setDolgozik(true);
    try {
      await kerdes.tenni();
      setKerdes(null);
    } finally {
      setDolgozik(false);
    }
  }

  if (q.isLoading || q.error || !e) {
    return (
      <Kepernyo ful="fiok" fejlec={<CimSor visszaCim="Vissza a fiókhoz" vissza={() => vissza('/fiok')} cim="Előfizetés" />}>
        {q.isLoading ? <Betolt /> : <Hiba hiba={q.error} ujra={() => void q.refetch()} />}
      </Kepernyo>
    );
  }

  const ma = maiNap();
  const fizetettKezd = e.nextPaidPeriodStart ?? ma;
  const elore = fizetettKezd > ma; // a még futó, kifizetett hónap után kezdődik
  const sav = honapSav(fizetettKezd);
  const fut = e.status === 'active' && !e.cancelAtPeriodEnd;
  const lemondva = e.status === 'active' && e.cancelAtPeriodEnd;
  const visszavonhato = lemondva && Boolean(e.card); // „Mégis maradok”: van mentett kártya, nem kell fizetni
  const vegeIg = e.currentPeriodEnd ? nagybetu(datumIg(e.currentPeriodEnd)) : 'A hónap végéig';

  // Melyik fő gomb kell, és mit fizet?
  let fo: { cim: string; elsodleges: boolean; magyaraz: string; tenni: () => void } | null = null;
  if (e.status === 'incomplete') {
    fo = { cim: 'Előfizetés indítása', elsodleges: true, magyaraz: '', tenni: () => router.push('/bekotes/elofizetes') };
  } else if (fut) {
    // Kártya nélkül (törölted): nem „csere”, hanem „megadás” – és kiírjuk, hogy enélkül a hónap végén leáll.
    const vanKartya = Boolean(e.card);
    fo = {
      cim: vanKartya ? 'Kártya cseréje' : 'Kártya megadása',
      elsodleges: !vanKartya,
      magyaraz: elore ? `A SimplePay ${vanKartya ? 'az új kártyát' : 'a kártyát'} egy fizetéssel menti el: ekkor a következő hónapot fizeted ki előre (${sav}). A mostani hónapért nem fizetsz újra.` : '',
      tenni: () =>
        setKerdes({
          cim: vanKartya ? 'Lecseréled a kártyádat?' : 'Megadod a kártyádat?',
          szoveg: [
            `${vanKartya ? 'Az új kártyát' : 'A kártyát'} a SimplePay egy fizetéssel menti: most ${szam(e.priceHuf)} Ft-ot vonunk le, ez a következő hónap díja (${sav}).`,
            vanKartya ? 'A mostani, már kifizetett hónapért nem fizetsz újra. A régi kártyádat utána töröljük.' : 'A mostani, már kifizetett hónapért nem fizetsz újra.',
          ],
          gomb: 'Tovább a fizetéshez',
          tenni: () => fizetes('card_update'),
        }),
    };
  } else if (lemondva && !visszavonhato) {
    fo = {
      cim: 'Előfizetés folytatása',
      elsodleges: true,
      magyaraz: `Add meg újra a kártyádat. ${elore ? `A következő hónapot fizeted ki (${sav}); ${datumIg(e.currentPeriodEnd ?? fizetettKezd)} a mostani hónapod fut.` : ''}`,
      tenni: () => void fizetes('subscribe'),
    };
  } else if (e.status === 'canceled') {
    fo = {
      cim: 'Előfizetés újraindítása',
      elsodleges: true,
      magyaraz: elore ? `${vegeIg} még fut a kifizetett hónapod. Ha most újraindítod, az utána következő hónapot fizeted ki (${sav}).` : `Ha újraindítod, ma kezdődik az új hónapod (${sav}).`,
      tenni: () => void fizetes('subscribe'),
    };
  } else if (e.status === 'past_due' || e.status === 'suspended') {
    fo = { cim: 'Kártya cseréje', elsodleges: true, magyaraz: '', tenni: () => void fizetes('card_update') };
  }

  return (
    <Kepernyo ful="fiok" fejlec={<CimSor visszaCim="Vissza a fiókhoz" vissza={() => vissza('/fiok')} cim="Előfizetés" al={`Havi ${szam(e.priceHuf)} Ft, bruttó.`} />}>
      {e.mode === 'demo' ? <DemoFizetesJel /> : null}
      {e.status === 'past_due' || e.status === 'suspended' ? (
        <View style={{ borderRadius: 12, ...jelzoDoboz('figyelem'), padding: 14, marginBottom: 12 }}>
          <T m={15.5} s={650} c={szin.borostyanSzoveg} lh={1.45}>
            {e.status === 'past_due' ? 'Nem sikerült levonni a havidíjat.' : 'Az előfizetésed szünetel, mert nem sikerült levonni a havidíjat.'}
          </T>
          <T m={14.5} c={szin.borostyanSzoveg} lh={1.45} style={{ marginTop: 2 }}>
            {e.graceUntil ? `${nagybetu(datumIg(e.graceUntil))} még minden megy tovább. ` : ''}Cseréld a kártyát, vagy nézd meg, van-e rajta fedezet.
          </T>
        </View>
      ) : null}
      {e.status === 'canceled' || lemondva ? (
        <View style={{ borderRadius: 12, ...jelzoDoboz('figyelem'), padding: 14, marginBottom: 12 }}>
          <T m={15.5} s={650} c={szin.borostyanSzoveg} lh={1.45}>
            {e.currentPeriodEnd && e.currentPeriodEnd > ma ? `${vegeIg} intézzük a könyvelésed, utána leáll.` : 'Az előfizetésed lejárt, a könyvelőd már nem dolgozik rajta.'}
          </T>
        </View>
      ) : null}
      {fut && !e.card ? (
        <View style={{ borderRadius: 12, ...jelzoDoboz('figyelem'), padding: 14, marginBottom: 12 }} accessibilityLiveRegion="polite">
          <T m={15.5} s={650} c={szin.borostyanSzoveg} lh={1.45}>
            Nincs mentett kártyád.
          </T>
          <T m={14.5} c={szin.borostyanSzoveg} lh={1.45} style={{ marginTop: 2 }}>
            {e.currentPeriodEnd ? `${vegeIg} él az előfizetésed, utána csak új kártyával folytatódik.` : 'Az előfizetésed csak új kártyával folytatódik.'}
          </T>
        </View>
      ) : null}
      <Lap>
        <Sor2 elso cim="Állapot" ertek={fut ? 'Él' : lemondva ? 'Lemondva' : e.status === 'canceled' ? 'Megszűnt' : e.status === 'incomplete' ? 'Még nincs elindítva' : e.status === 'past_due' ? 'Fizetés sikertelen' : 'Szünetel'} />
        {e.currentPeriodEnd ? <Sor2 cim={fut ? 'A mostani hónap vége' : 'Eddig fizetted ki'} ertek={datumEvvel(e.currentPeriodEnd)} /> : null}
        {/* kártya nélkül nincs miből levonni: a „Következő levonás” sor ilyenkor nem jelenik meg */}
        {e.nextChargeAt && fut && e.card ? <Sor2 cim="Következő levonás" ertek={datumEvvel(e.nextChargeAt)} /> : null}
        {e.card ? <Sor2 cim="Kártya" ertek={`${e.card.mask.replace(/x/g, '•')}, lejár ${e.card.expiry.slice(0, 7).replace('-', '/')}`} /> : <Sor2 cim="Kártya" ertek="nincs mentett kártya" />}
        {e.card && fut ? <Sor2 cim="Még levonható alkalom" ertek={`${e.card.tokensLeft}, ${datumEvvelIg(e.card.tokensUntil)}`} /> : null}
      </Lap>
      {e.card && fut && e.card.tokensLeft <= 1 ? (
        <T m={14.5} c={szin.halvanyAlapon} lh={1.45} style={{ marginTop: 10, paddingHorizontal: 4 }}>
          A SimplePay egy kártyamentéssel legfeljebb 12 levonást enged. Hamarosan kérünk egy új kártyamegerősítést; ehhez a „Kártya cseréje” gombot használd.
        </T>
      ) : null}
      <HibaSzoveg szoveg={hiba} />
      {fo ? (
        <>
          {fo.magyaraz ? (
            <T m={14.5} c={szin.halvanyAlapon} lh={1.45} style={{ marginTop: 14, paddingHorizontal: 4 }}>
              {fo.magyaraz}
            </T>
          ) : null}
          {fo.elsodleges ? <GombE cim={fo.cim} onPress={fo.tenni} tolt={tolt} style={{ marginTop: 14 }} /> : <GombM cim={fo.cim} onPress={fo.tenni} tolt={tolt} style={{ marginTop: 14 }} />}
        </>
      ) : null}

      {e.status !== 'incomplete' && e.status !== 'canceled' ? <Szakasz cim="Ha mennél" /> : null}
      {e.status !== 'incomplete' && e.status !== 'canceled' ? (
        <Lap style={{ padding: 18 }}>
          {lemondva ? (
            <>
              <T m={15.5} lh={1.5}>
                Lemondtad. {vegeIg} minden megy tovább, utána nem vonunk le többet.
              </T>
              {visszavonhato ? (
                <GombM
                  cim="Mégis maradok"
                  onPress={async () => {
                    try {
                      await folytat.mutateAsync();
                      jelez({ szoveg: 'Örülünk! Az előfizetésed marad.', kesz: true });
                    } catch (x) {
                      jelez(x instanceof ApiHiba ? x.message : 'Nem sikerült.');
                    }
                  }}
                  style={{ marginTop: 12 }}
                />
              ) : null}
            </>
          ) : (
            <>
              <T m={15.5} lh={1.5}>
                Bármikor lemondhatod. A kifizetett hónap végéig a könyvelőd mindent intéz, utána nem vonunk le többet. A már beadott bevallások és a dossziéd letölthetők maradnak.
              </T>
              <GombSz
                cim="Lemondom az előfizetést"
                veszely
                onPress={() =>
                  setKerdes({
                    cim: szoveg('lemondas.kerdes', {}, 'Lemondod az előfizetést?'),
                    szoveg: szovegLista('lemondas.kovetkezmeny', ertekek),
                    gomb: szoveg('lemondas.megerosites', {}, 'Lemondom'),
                    veszely: true,
                    tenni: async () => {
                      try {
                        await lemond.mutateAsync();
                        jelez(e.currentPeriodEnd ? `Lemondtad. ${nagybetu(datumIg(e.currentPeriodEnd))} minden marad.` : 'Lemondtad.');
                      } catch (x) {
                        jelez(x instanceof ApiHiba ? x.message : 'Nem sikerült.');
                      }
                    },
                  })
                }
              />
            </>
          )}
          {e.card ? (
            <GombSz
              cim="Kártyám törlése"
              veszely
              onPress={() =>
                setKerdes({
                  cim: szoveg('kartya_torles.kerdes', {}, 'Törlöd a kártyádat?'),
                  szoveg: [szoveg('kartya_torles.kovetkezmeny', ertekek, 'A SimplePay-nél is töröljük.')],
                  gomb: 'Törlöm',
                  veszely: true,
                  tenni: async () => {
                    try {
                      await torol.mutateAsync();
                      jelez('Töröltük a kártyádat.');
                    } catch (x) {
                      jelez(x instanceof ApiHiba ? x.message : 'Nem sikerült.');
                    }
                  },
                })
              }
            />
          ) : null}
        </Lap>
      ) : null}

      <AlsoLap lathato={Boolean(kerdes)} bezar={() => setKerdes(null)}>
        {kerdes ? (
          <View style={{ paddingTop: 8 }}>
            <T m={21} s={650} ls={-0.02} lh={1.25} style={{ paddingRight: 90 }} accessibilityRole="header">
              {kerdes.cim}
            </T>
            {kerdes.szoveg.map((x, i) => (
              <T key={i} m={15.5} lh={1.5} c={szin.halvany} style={{ marginTop: 10 }}>
                {x}
              </T>
            ))}
            {kerdes.veszely ? (
              <GombE cim={kerdes.gomb} tolt={dolgozik} onPress={() => void igen()} style={{ marginTop: 22, backgroundColor: szin.veszely }} />
            ) : (
              <GombE cim={kerdes.gomb} tolt={dolgozik} onPress={() => void igen()} style={{ marginTop: 22 }} />
            )}
            <GombSz cim="Mégse" onPress={() => setKerdes(null)} style={{ alignSelf: 'center', marginTop: 8 }} />
          </View>
        ) : null}
      </AlsoLap>
    </Kepernyo>
  );
}

