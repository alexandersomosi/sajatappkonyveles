// SPEC §29.1.13 – the card step (guided run and /bekotes/elofizetes): "Utolsó lépés: a kártyád", what the client gets,
// the card consent in full with one checkbox, "Tovább a kártyához ({osszeg} Ft)" → the Stripe page (or the DEMO pay page).
// No free period: the first month is paid now (§29.4.2). PAYMENT_PROVIDER=simplepay → the kept SimplePay screen.
// Előtte (SimplePay): kod/app/_regi/elotte_k7_b3/src/app/bekotes/elofizetes.tsx
// k8 ALAP-B: first the optional callback offer (the payment only after it), then "Hogyan fizetnél?" card / transfer when
// the server offers the transfer (/config fizetes.atutalas); the transfer path shows the díjbekérő's details.
// Előtte: kod/app/_regi/elotte_k8_B/src/app/bekotes/elofizetes.tsx
import { useState } from 'react';
import { View } from 'react-native';
import { STEP_LOCK_DEFAULT_TEXTS } from '@/_shared/bekotes';
import { LOCK_ELOFIZETES_SZERZODES_UTAN } from '@/_shared/enums';
import { CARD_CONSENT_UI, PAYMENT_SCREEN_TEXTS as P } from '@/_shared/k29';
import { ApiHiba } from '@/api/http';
import { useConfig, useOnboarding } from '@/api/hooks';
import { useElofizetesK29, useKartyaEngedely } from '@/api/hooks-k29';
import { useGuided } from '@/api/hooks-k29g';
import { useSzamlazas } from '@/api/hooks-k8';
import { AtutalasBekotes, AtutalasValaszto, type FizetesMod } from '@/kepernyok/Atutalas';
import { VisszahivasAjanlat } from '@/kepernyok/VisszahivasAjanlat';
import { brand } from '@/config';
import { szam } from '@/lib/format';
import { fizetesSzolgaltato, kartyaMentes } from '@/lib/fizetes';
import { hibaUzenet } from '@/lib/hiba';
import { szovegLista } from '@/lib/szovegek';
import { bekotesre } from '@/lib/vezetett';
import { engedelyGomb, KartyaEngedely } from '@/kepernyok/KartyaEngedely';
import { SimplePayKartyaLepes } from '@/kepernyok/simplepay/KartyaLepes';
import { szin } from '@/theme/tokens';
import { Felsorolas, GombE, GombM, HibaSzoveg, Lap, Szakasz } from '@/ui/alap';
import { DemoFizetesJel } from '@/ui/DemoJel';
import { Ikon3d } from '@/ui/kepek';
import { Betolt, CimSor, Hiba, Kepernyo, vissza } from '@/ui/keret';
import { MiEz } from '@/ui/Magyarazat';
import { T } from '@/ui/T';
import { Elakadtal } from '@/ui/Visszahivas';

export default function Elofizetes() {
  const cfg = useConfig();
  if (cfg.isLoading) return <Kepernyo><Betolt /></Kepernyo>;
  if (fizetesSzolgaltato(cfg.data) === 'simplepay') return <SimplePayKartyaLepes />;
  return <KartyaLepes />;
}

function KartyaLepes() {
  const cfg = useConfig();
  const elo = useElofizetesK29();
  const o = useOnboarding();
  const [be, setBe] = useState(false);
  const [tolt, setTolt] = useState(false);
  const [hiba, setHiba] = useState<string | null>(null);
  const ar = elo.data?.monthlyHuf ?? cfg.data?.brand.priceHufMonthlyGross ?? brand.priceHufMonthlyGross;
  const acc = o.data?.accountant;
  // k7c2: a cancelled (or terminated, then reactivated) subscription that still runs to its period end is NOT "él": the
  // step needs a new consent + card (the first payment covers the month after the paid one – never the same month twice)
  const aktiv = elo.data?.status === 'active' && !elo.data?.cancelAtPeriodEnd;
  const kikapcsolva = fizetesSzolgaltato(cfg.data) === 'disabled';
  // k8: the transfer (switch ON on the server, or already chosen) and the callback offer before any payment
  const sz = useSzamlazas(!aktiv);
  const g = useGuided(!aktiv);
  const [modValasztott, setMod] = useState<FizetesMod | null>(null);
  const atutalhato = !!(cfg.data?.fizetes?.atutalas || sz.data?.method === 'atutalas' || sz.data?.open.length);
  const mod: FizetesMod = modValasztott ?? (sz.data?.method === 'atutalas' || sz.data?.open.length ? 'atutalas' : 'kartya');
  const ajanlat = g.data?.steps.find((x) => x.key === 'visszahivas_ajanlat');
  const ajanlatKell = !aktiv && !!ajanlat && (ajanlat.state === 'nyitva' || ajanlat.state === 'var');

  // SPEC §27.4.2: a kártya mindkét úton a szerződés után jön (a szerver zárja; régebbi szervernél itt is).
  const lepes0 = o.data?.steps.find((x) => x.step === 'elofizetes');
  const szerzodesNincs = !!o.data && o.data.steps.find((x) => x.step === 'szerzodes')?.status !== 'kesz' && lepes0?.status !== 'kesz';
  const lepes = lepes0 && !lepes0.locked && szerzodesNincs ? { ...lepes0, locked: true, lockedReason: STEP_LOCK_DEFAULT_TEXTS[LOCK_ELOFIZETES_SZERZODES_UTAN] } : lepes0;
  const engedely = useKartyaEngedely(!aktiv && !lepes?.locked && !kikapcsolva && !ajanlatKell && mod === 'kartya', elo.data?.status === 'canceled' ? 'restart' : 'subscribe');
  const c = engedely.data;
  const demo = c?.demo ?? (cfg.data?.demo && fizetesSzolgaltato(cfg.data) === 'demo');
  const fej = <CimSor visszaCim="Vissza a Főoldalra" vissza={() => vissza('/bekotes')} cim={P.cardStep.bandTitle} al={P.cardStep.bandText.replace('{havidij}', szam(ar))} />;

  if (lepes?.locked) {
    return (
      <Kepernyo ful="fooldal" fejlec={fej}>
        <Lap style={{ padding: 16 }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Ikon3d nev="lakat" pt={44} label="Zárolva" />
            <T m={17} s={600} lh={1.45} style={{ flex: 1 }}>
              {lepes.lockedReason ?? 'A kártyádat a szerződés után kérjük.'}
            </T>
          </View>
          <MiEz kulcs="elofizetes" style={{ alignSelf: 'flex-start', marginTop: 8 }} />
        </Lap>
        <Elakadtal forras="elofizetes" tema="elofizetes" style={{ marginTop: 6, marginLeft: 4 }} />
      </Kepernyo>
    );
  }

  if (ajanlatKell) {
    return (
      <Kepernyo ful="fooldal" fejlec={fej}>
        <VisszahivasAjanlat nyitott={ajanlat!.state === 'var'} tovabb={() => void g.refetch()} />
      </Kepernyo>
    );
  }

  if (mod === 'atutalas' && atutalhato && !aktiv) {
    return (
      <Kepernyo ful="fooldal" fejlec={fej}>
        {cfg.data?.demo ? <DemoFizetesJel style={{ marginTop: 4 }} /> : null}
        {!sz.data?.open.length ? <AtutalasValaszto mod={mod} valt={setMod} /> : null}
        <AtutalasBekotes v={sz.data} kesz={() => bekotesre()} />
        <Elakadtal forras="elofizetes" tema="elofizetes" style={{ marginTop: 6, marginLeft: 4 }} />
      </Kepernyo>
    );
  }

  async function tovabb() {
    if (!c) return;
    if (!be) return setHiba('Előbb pipáld be, hogy elolvastad és engedélyezed.');
    setHiba(null);
    setTolt(true);
    try {
      await kartyaMentes(elo.data?.status === 'canceled' ? 'restart' : 'subscribe', c);
    } catch (e) {
      if (e instanceof ApiHiba && e.status === 409 && /consent|szöveg/i.test(`${e.code} ${e.message}`)) {
        setBe(false);
        void engedely.refetch();
        setHiba(CARD_CONSENT_UI.changed);
      } else setHiba(hibaUzenet(e, 'Nem sikerült elindítani a fizetést. Próbáld újra.'));
    } finally {
      setTolt(false);
    }
  }

  if (aktiv) {
    return (
      <Kepernyo ful="fooldal" fejlec={fej} dokk={<GombE cim="Tovább" onPress={() => bekotesre()} />}>
        <Lap style={{ padding: 16 }}>
          <T m={18} s={650} lh={1.35}>
            Az előfizetésed él.
          </T>
          <T m={16} c={szin.halvany} lh={1.5} style={{ marginTop: 4 }}>
            {elo.data?.cardInfo ? `A kártyád: ${elo.data.cardInfo.label}. ` : ''}A részleteket a Fiók oldalon látod.
          </T>
        </Lap>
      </Kepernyo>
    );
  }

  return (
    <Kepernyo ful="fooldal" fejlec={fej} dokk={c && !kikapcsolva ? <GombE cim={engedelyGomb(c)} onPress={() => void tovabb()} tolt={tolt} disabled={!be} /> : undefined}>
      {demo ? <DemoFizetesJel style={{ marginTop: 4 }} /> : null}
      {atutalhato ? <AtutalasValaszto mod={mod} valt={setMod} /> : null}
      <Szakasz ikon="igazolas" cim="Mit kapsz ezért?" jobbra={<MiEz kulcs="elofizetes" />} />
      <Lap style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        <Felsorolas
          style={{ paddingLeft: 54 }}
          elemek={[
            ...szovegLista('ar.mit_kapsz', {}, ['Saját könyvelő, aki név szerint ismer.', 'Kiszámolja, mennyit kell fizetned, és beadja a bevallásaidat.']),
            ...(acc?.responseTimeText ? [`${acc.firstName}: ${acc.responseTimeText.charAt(0).toLowerCase()}${acc.responseTimeText.slice(1)}.`] : []),
          ]}
        />
      </Lap>
      <Szakasz ikon="szamlaszam" cim="Kártyás fizetés – engedély" />
      <Lap style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        {engedely.isLoading ? (
          <Betolt />
        ) : engedely.error || !c ? (
          <Hiba hiba={engedely.error} ujra={() => void engedely.refetch()} />
        ) : (
          <KartyaEngedely
            c={c}
            be={be}
            valt={(b) => {
              setBe(b);
              if (b) setHiba(null);
            }}
            alatta={
              <T m={14.5} c={szin.halvany} lh={1.45} style={{ marginTop: 8 }}>
                {CARD_CONSENT_UI.underLong}
              </T>
            }
          />
        )}
        {kikapcsolva ? (
          <T m={15} s={600} c={szin.veszely} lh={1.45} style={{ marginTop: 12 }}>
            A kártyás fizetés még nincs bekapcsolva. Amint elindul, szólunk.
          </T>
        ) : null}
        <HibaSzoveg szoveg={hiba} />
        {hiba === CARD_CONSENT_UI.changed ? <GombM cim="Újra elolvasom" onPress={() => void engedely.refetch()} style={{ marginTop: 8 }} /> : null}
      </Lap>
      <Elakadtal forras="elofizetes" tema="elofizetes" style={{ marginTop: 6, marginLeft: 4 }} />
    </Kepernyo>
  );
}
