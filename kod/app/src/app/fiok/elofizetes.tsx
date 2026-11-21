// SPEC §29.1.13 / §29.1.11 – Fiók → Előfizetés: "Havidíj" · "Következő levonás" (or "Lemondva – {datum}-ig él") ·
// "Kártya" {Visa •••• 4242}, "lejár {hh/éé}"; capsules "Kártya cseréje" (the consent first, then the Stripe setup page –
// no money moves while a paid period runs) and "Kártya törlése"; text link "Lemondom". An open payment problem → a red
// section on top with "Fizesd ki". PAYMENT_PROVIDER=simplepay (or a SimplePay subscription) → the kept SimplePay screen.
// Előtte: kod/app/_regi/elotte_k7_b3/src/app/fiok/elofizetes.tsx
// k8 ALAP-B: "Fizetés módja" – kártya / átutalás, the open díjbekérők with their details, "Átváltok kártyára" (the card
// sheet below) / "Átváltok átutalásra" (from the next period). Előtte: kod/app/_regi/elotte_k8_B/src/app/fiok/elofizetes.tsx
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { fillPlaceholders } from '@/_shared/bekotes';
import { CARD_CONSENT_UI, PAYMENT_SCREEN_TEXTS as P, type SubscriptionViewK29 } from '@/_shared/k29';
import { ApiHiba } from '@/api/http';
import { useConfig, useElofizetesFolytat, useElofizetesLemond, useKartyaTorles } from '@/api/hooks';
import { useElofizetesK29, useKartyaEngedely } from '@/api/hooks-k29';
import { datumEvvel, datumEvvelIg, datumIg, maiNap, nagybetu, szam } from '@/lib/format';
import { fizetesSzolgaltato, kartyaMentes } from '@/lib/fizetes';
import { hibaUzenet } from '@/lib/hiba';
import { engedelyGomb, KartyaEngedely } from '@/kepernyok/KartyaEngedely';
import { AtutalasFiok } from '@/kepernyok/Atutalas';
import { SimplePayKezeles } from '@/kepernyok/simplepay/Kezeles';
import { szin } from '@/theme/tokens';
import { GombE, GombM, GombSz, HibaSzoveg, Lap, Szakasz } from '@/ui/alap';
import { DemoFizetesJel } from '@/ui/DemoJel';
import { AlsoLap, Betolt, CimSor, Hiba, Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { T } from '@/ui/T';

function Sor2({ cim, ertek, al, elso }: { cim: string; ertek: string; al?: string | null; elso?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', gap: 14, paddingVertical: 12, paddingHorizontal: 16, borderTopWidth: elso ? 0 : 1, borderTopColor: szin.hajszal }}>
      <T m={15.5} c={szin.halvany}>
        {cim}
      </T>
      <View style={{ flexShrink: 1, alignItems: 'flex-end' }}>
        <T m={16} s={600} jobb szam>
          {ertek}
        </T>
        {al ? (
          <T m={14.5} c={szin.halvany} jobb>
            {al}
          </T>
        ) : null}
      </View>
    </View>
  );
}

export default function ElofizetesKezeles() {
  const cfg = useConfig();
  const q = useElofizetesK29();
  const fej = <CimSor visszaCim="Vissza a fiókhoz" vissza={() => vissza('/fiok')} cim="Előfizetés" />;
  if (cfg.isLoading || q.isLoading) return <Kepernyo ful="fiok" fejlec={fej}><Betolt /></Kepernyo>;
  const szolg = fizetesSzolgaltato(cfg.data);
  if (q.data?.provider === 'simplepay' || (!q.data?.provider && szolg === 'simplepay')) return <SimplePayKezeles />;
  if (q.error || !q.data) return <Kepernyo ful="fiok" fejlec={fej}><Hiba hiba={q.error} ujra={() => void q.refetch()} /></Kepernyo>;
  return <Kezeles e={q.data} demo={q.data.provider === 'demo' || q.data.mode === 'demo' || (szolg === 'demo' && !!cfg.data?.demo)} />;
}

type Kerdes = { cim: string; szoveg: string[]; gomb: string; veszely?: boolean; tenni: () => Promise<void> } | { kartya: true };

function Kezeles({ e, demo }: { e: SubscriptionViewK29; demo: boolean }) {
  const lemond = useElofizetesLemond();
  const folytat = useElofizetesFolytat();
  const torol = useKartyaTorles();
  const jelez = useJelzes();
  const [kerdes, setKerdes] = useState<Kerdes | null>(null);
  const [dolgozik, setDolgozik] = useState(false);
  const [be, setBe] = useState(false);
  const [hiba, setHiba] = useState<string | null>(null);
  const kartyaLap = !!kerdes && 'kartya' in kerdes;
  // a card change while money is due is a "Fizesd ki" with the new card (the server decides; the consent follows it)
  const engedely = useKartyaEngedely(kartyaLap, e.due ? 'fizesd_ki' : 'card_update');
  const ma = maiNap();
  const havi = e.monthlyHuf ?? e.nextChargeAmountHuf ?? e.priceHuf;
  const fut = e.status === 'active' && !e.cancelAtPeriodEnd;
  const lemondva = e.status === 'active' && e.cancelAtPeriodEnd;
  // k7c2: WE terminated the contract – one end date (terminated.effectiveOn), never "Lemondtad" / "Mégis maradok"
  const felmondva = e.terminatedUntil ?? null;
  const kartya = e.cardInfo ?? null;
  const vegeIg = e.currentPeriodEnd ? datumIg(e.currentPeriodEnd) : 'a hónap végéig';
  const allapot = felmondva ? 'Felmondtuk' : fut ? 'Él' : lemondva ? 'Lemondva' : e.status === 'canceled' ? 'Megszűnt' : e.status === 'incomplete' ? 'Még nincs elindítva' : e.status === 'past_due' ? 'Fizetésre vár' : 'Szünetel';

  async function igen() {
    if (!kerdes || 'kartya' in kerdes) return;
    setDolgozik(true);
    try {
      await kerdes.tenni();
      setKerdes(null);
    } finally {
      setDolgozik(false);
    }
  }
  async function kartyaCsere() {
    const c = engedely.data;
    if (!c) return;
    if (!be) return setHiba('Előbb pipáld be, hogy elolvastad és engedélyezed.');
    setHiba(null);
    setDolgozik(true);
    try {
      await kartyaMentes('card_update', c);
      setKerdes(null);
    } catch (x) {
      if (x instanceof ApiHiba && x.status === 409 && /consent|szöveg/i.test(`${x.code} ${x.message}`)) {
        setBe(false);
        void engedely.refetch();
        setHiba(CARD_CONSENT_UI.changed);
      } else setHiba(hibaUzenet(x, 'Nem sikerült elindítani. Próbáld újra.'));
    } finally {
      setDolgozik(false);
    }
  }

  return (
    <Kepernyo ful="fiok" fejlec={<CimSor visszaCim="Vissza a fiókhoz" vissza={() => vissza('/fiok')} cim="Előfizetés" al={`Havi ${szam(havi)} Ft, bruttó. Bármikor lemondhatod.`} />}>
      {demo ? <DemoFizetesJel style={{ marginTop: 4 }} /> : null}
      {e.due ? (
        <Lap style={{ padding: 16, borderLeftWidth: 4, borderLeftColor: szin.veszely }}>
          <T m={18} s={700} lh={1.3} c={szin.veszelySzoveg} accessibilityRole="header">
            {fillPlaceholders(P.fizesdKi.homeBanner, { osszeg: szam(e.due.amountHuf) })}
          </T>
          <T m={15.5} lh={1.45} c={szin.veszelySzoveg} style={{ marginTop: 4 }}>
            {e.due.text}
          </T>
          <GombE cim={P.fizesdKi.homeButton} onPress={() => router.push('/fizesd-ki')} style={{ marginTop: 12 }} />
        </Lap>
      ) : null}
      <Lap>
        <Sor2 elso cim="Állapot" ertek={allapot} />
        <Sor2 cim={P.account.monthly} ertek={`${szam(havi)} Ft`} al={e.monthlySource === 'szunetel' ? 'szünetelés alatt' : e.monthlySource === 'ingyenes_honap' ? 'ebben a hónapban nem vonunk le' : null} />
        {felmondva ? (
          <Sor2 cim="Meddig marad" ertek={datumEvvel(felmondva)} al="addig minden szolgáltatás jár, levonás nincs" />
        ) : lemondva && e.currentPeriodEnd ? (
          <Sor2 cim={P.account.nextCharge} ertek={fillPlaceholders(P.account.canceledUntil, { datum: datumEvvel(e.currentPeriodEnd) })} />
        ) : fut && e.nextChargeAt && kartya ? (
          <Sor2 cim={P.account.nextCharge} ertek={datumEvvel(e.nextChargeAt)} al={`${szam(e.nextChargeAmountHuf ?? havi)} Ft`} />
        ) : e.currentPeriodEnd && e.status !== 'incomplete' ? (
          <Sor2 cim="Eddig fizetted ki" ertek={datumEvvel(e.currentPeriodEnd)} />
        ) : null}
        <Sor2 cim={P.account.card} ertek={kartya ? kartya.label : 'nincs mentett kártya'} al={kartya?.expiryLabel ? fillPlaceholders(P.account.expires, { lejarat: kartya.expiryLabel }) + (kartya.expiringSoon ? ' – hamarosan' : '') : null} />
        {e.status !== 'incomplete' && e.status !== 'canceled' ? (
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap', paddingHorizontal: 16, paddingTop: 4, paddingBottom: 16 }}>
            <GombM
              cim={kartya ? P.account.changeCard : 'Kártya megadása'}
              onPress={() => {
                setBe(false);
                setHiba(null);
                setKerdes({ kartya: true });
              }}
            />
            {kartya ? (
              <GombM
                cim={P.account.deleteCard}
                onPress={() =>
                  setKerdes({
                    cim: 'Törlöd a kártyádat?',
                    szoveg: [`A Stripe-nál is töröljük. ${nagybetu(vegeIg)} minden marad; utána csak új kártyával megy tovább.`],
                    gomb: 'Törlöm',
                    veszely: true,
                    tenni: async () => {
                      try {
                        await torol.mutateAsync();
                        jelez('Töröltük a kártyádat.');
                      } catch (x) {
                        jelez(hibaUzenet(x, 'Nem sikerült.'));
                      }
                    },
                  })
                }
              />
            ) : null}
          </View>
        ) : null}
      </Lap>
      <AtutalasFiok
        kartyara={() => {
          setBe(false);
          setHiba(null);
          setKerdes({ kartya: true });
        }}
      />
      {fut && !kartya ? (
        <T m={15} lh={1.45} c={szin.halvanyAlapon} style={{ marginTop: 10, paddingHorizontal: 4 }}>
          {`${nagybetu(vegeIg)} él az előfizetésed, utána csak új kártyával folytatódik.`}
        </T>
      ) : null}
      {(e.status === 'incomplete' || e.status === 'canceled') && !felmondva ? (
        <Lap style={{ padding: 16 }}>
          <T m={16} lh={1.5}>
            {e.status === 'canceled' ? (e.currentPeriodEnd && e.currentPeriodEnd > ma ? `${nagybetu(vegeIg)} intézzük a könyvelésed, utána leáll.` : 'Az előfizetésed lejárt.') : 'Még nem adtad meg a kártyádat.'}
          </T>
          <GombE cim={e.status === 'canceled' ? 'Előfizetés újraindítása' : 'Előfizetés indítása'} onPress={() => router.push('/bekotes/elofizetes')} style={{ marginTop: 12 }} />
        </Lap>
      ) : null}

      {e.status !== 'incomplete' && e.status !== 'canceled' ? <Szakasz ikon="kerdezek" cim="Ha mennél" /> : null}
      {e.status !== 'incomplete' && e.status !== 'canceled' ? (
        <Lap style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
          <View style={{ paddingLeft: 54 }}>
            {felmondva ? (
              <T m={16} lh={1.5}>
                {`Felmondtuk a szerződésedet. ${nagybetu(datumIg(felmondva))} minden marad, utána nem vonunk le többet. A felmondó levelet a dossziédban találod.`}
              </T>
            ) : lemondva ? (
              <>
                <T m={16} lh={1.5}>
                  {`Lemondtad. ${nagybetu(vegeIg)} minden megy tovább, utána nem vonunk le többet.`}
                </T>
                {kartya ? (
                  <GombM
                    cim="Mégis maradok"
                    style={{ marginTop: 12 }}
                    onPress={async () => {
                      try {
                        await folytat.mutateAsync();
                        jelez({ szoveg: 'Örülünk! Az előfizetésed marad.', kesz: true });
                      } catch (x) {
                        jelez(hibaUzenet(x, 'Nem sikerült.'));
                      }
                    }}
                  />
                ) : null}
              </>
            ) : (
              <>
                <T m={16} lh={1.5}>
                  Bármikor lemondhatod. A kifizetett hónap végéig a könyvelőd mindent intéz, utána nem vonunk le többet. A már beadott bevallások és a dossziéd letölthetők maradnak.
                </T>
                <GombSz
                  cim={P.account.cancel}
                  veszely
                  m={16}
                  onPress={() =>
                    setKerdes({
                      cim: 'Lemondod az előfizetést?',
                      szoveg: [fillPlaceholders(P.account.cancelConfirm, { idoszakVege: e.currentPeriodEnd ? datumEvvel(e.currentPeriodEnd).replace(/\.$/, '') : 'a hónap vége' })],
                      gomb: 'Lemondom',
                      veszely: true,
                      tenni: async () => {
                        try {
                          await lemond.mutateAsync();
                          jelez(e.currentPeriodEnd ? `Lemondtad. ${datumEvvelIg(e.currentPeriodEnd)} minden marad.` : 'Lemondtad.');
                        } catch (x) {
                          jelez(hibaUzenet(x, 'Nem sikerült.'));
                        }
                      },
                    })
                  }
                />
              </>
            )}
          </View>
        </Lap>
      ) : null}

      <AlsoLap lathato={Boolean(kerdes)} bezar={() => setKerdes(null)}>
        {kerdes && 'kartya' in kerdes ? (
          <View style={{ paddingTop: 8 }}>
            <T m={21} s={650} ls={-0.02} lh={1.25} style={{ paddingRight: 90 }} accessibilityRole="header">
              {kartya ? 'Kártya cseréje' : 'Kártya megadása'}
            </T>
            <T m={15.5} lh={1.5} c={szin.halvany} style={{ marginTop: 6, marginBottom: 10 }}>
              {e.due ? 'Az új kártyával rögtön kifizeted a függő havidíjat is.' : 'Most nem vonunk le semmit: a Stripe csak elmenti az új kártyát. A következő levonás már erről megy.'}
            </T>
            {engedely.data ? <KartyaEngedely c={engedely.data} be={be} valt={setBe} /> : engedely.error ? <Hiba hiba={engedely.error} ujra={() => void engedely.refetch()} /> : <Betolt />}
            <HibaSzoveg szoveg={hiba} />
            <GombE cim={engedelyGomb(engedely.data)} tolt={dolgozik} disabled={!engedely.data || !be} onPress={() => void kartyaCsere()} style={{ marginTop: 16 }} />
            <T m={14} c={szin.halvany} lh={1.45} kozep style={{ marginTop: 8 }}>
              {CARD_CONSENT_UI.underLong}
            </T>
            <GombSz cim="Mégse" onPress={() => setKerdes(null)} style={{ alignSelf: 'center', marginTop: 4 }} />
          </View>
        ) : kerdes ? (
          <View style={{ paddingTop: 8 }}>
            <T m={21} s={650} ls={-0.02} lh={1.25} style={{ paddingRight: 90 }} accessibilityRole="header">
              {kerdes.cim}
            </T>
            {kerdes.szoveg.map((x, i) => (
              <T key={i} m={15.5} lh={1.5} c={szin.halvany} style={{ marginTop: 10 }}>
                {x}
              </T>
            ))}
            <GombE cim={kerdes.gomb} tolt={dolgozik} onPress={() => void igen()} style={[{ marginTop: 22 }, kerdes.veszely ? { backgroundColor: szin.veszely } : null]} />
            <GombSz cim="Mégse" onPress={() => setKerdes(null)} style={{ alignSelf: 'center', marginTop: 8 }} />
          </View>
        ) : null}
      </AlsoLap>
    </Kepernyo>
  );
}
