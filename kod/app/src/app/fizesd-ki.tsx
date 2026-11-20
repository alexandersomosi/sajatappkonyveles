// SPEC §29.1.5 / §29.1.13 – "Fizesd ki": the due month as a hosted on-session payment (the bank may ask for its check
// there – authentication_required, declined or expired card). Band "Fizetésre vár: {osszeg} Ft" / "A(z) {idoszak}
// havidíja…", the card in use, "Fizesd ki ({osszeg} Ft)" and "Másik kártyával fizetek" (the consent is shown again,
// because the new card becomes the saved card). The money state comes back from the server (result screen).
import { useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { fillPlaceholders } from '@/_shared/bekotes';
import { CARD_CONSENT_UI, PAYMENT_SCREEN_TEXTS as P } from '@/_shared/k29';
import { ApiHiba } from '@/api/http';
import { useConfig } from '@/api/hooks';
import { useElofizetesK29, useEsedekes, useKartyaEngedely } from '@/api/hooks-k29';
import { datum, datumIg, szam } from '@/lib/format';
import { fizesdKi, fizetesSzolgaltato, hostedNyit } from '@/lib/fizetes';
import { hibaUzenet } from '@/lib/hiba';
import { engedelyGomb, KartyaEngedely } from '@/kepernyok/KartyaEngedely';
import { szin } from '@/theme/tokens';
import { Fejlec, GombE, GombM, GombSz, HibaSzoveg, Lap, Szakasz } from '@/ui/alap';
import { DemoFizetesJel } from '@/ui/DemoJel';
import { Ikon3d } from '@/ui/kepek';
import { AlsoLap, Betolt, Hiba, Kepernyo, vissza } from '@/ui/keret';
import { T } from '@/ui/T';
import { SavVissza } from '@/ui/Vezetett';

export default function FizesdKi() {
  const cfg = useConfig();
  const e = useElofizetesK29();
  const due = useEsedekes();
  const [tolt, setTolt] = useState(false);
  const [hiba, setHiba] = useState<string | null>(null);
  const [masik, setMasik] = useState(false);
  const [be, setBe] = useState(false);
  const engedely = useKartyaEngedely(masik || !!e.data?.consentNeeded);
  const d = due.data ?? e.data?.due ?? null;
  const demo = !!cfg.data?.demo && (fizetesSzolgaltato(cfg.data) === 'demo' || e.data?.provider === 'demo');

  async function fizet(ujKartya: boolean) {
    setHiba(null);
    // the consent again when the card may change (or the stored one is outdated)
    const kell = ujKartya || !!e.data?.consentNeeded;
    if (kell && (!engedely.data || !be)) {
      if (!masik) setMasik(true);
      else setHiba('Előbb pipáld be, hogy elolvastad és engedélyezed.');
      return;
    }
    setTolt(true);
    try {
      if (d?.openUrl && !ujKartya) await hostedNyit(d.openUrl, 'fizesd-ki');
      else await fizesdKi(kell ? engedely.data : null);
      setMasik(false);
    } catch (x) {
      if (x instanceof ApiHiba && x.status === 409 && /consent|szöveg/i.test(`${x.code} ${x.message}`)) {
        setBe(false);
        setMasik(true);
        void engedely.refetch();
        setHiba(CARD_CONSENT_UI.changed);
      } else setHiba(hibaUzenet(x, 'Nem sikerült elindítani a fizetést. Próbáld újra.'));
    } finally {
      setTolt(false);
    }
  }

  if (due.isLoading && e.isLoading) return <Kepernyo><Betolt /></Kepernyo>;
  if (!d) {
    return (
      <Kepernyo fejlec={<Sav cim="Nincs fizetnivalód" szoveg="Minden díjad rendben van." />} dokk={<GombE cim="Főoldal" onPress={() => router.replace('/')} />}>
        {due.error && e.error ? <Hiba hiba={due.error} ujra={() => void due.refetch()} /> : null}
      </Kepernyo>
    );
  }
  const idoszak = `${datum(d.period.start)}–${datum(d.period.end)}`;
  return (
    <Kepernyo
      fejlec={<Sav cim={fillPlaceholders(P.fizesdKi.bandTitle, { osszeg: szam(d.amountHuf) })} szoveg={fillPlaceholders(P.fizesdKi.bandText, { idoszak })} />}
      dokk={<GombE cim={fillPlaceholders(P.fizesdKi.button, { osszeg: szam(d.amountHuf) })} tolt={tolt} onPress={() => void fizet(false)} />}
    >
      {demo ? <DemoFizetesJel style={{ marginTop: 4 }} /> : null}
      <Szakasz ikon="szamlaszam" cim={d.title || 'Miért kell?'} />
      <Lap style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        <View style={{ paddingLeft: 38 }}>
          <T m={16} lh={1.5}>
            {d.text}
          </T>
          {d.graceUntil ? (
            <T m={15} lh={1.45} c={szin.halvany} style={{ marginTop: 6 }}>
              {`Ha ${datumIg(d.graceUntil)} sem sikerül, a könyvelésed szünetel. Kifizetés után rögtön megy tovább.`}
            </T>
          ) : null}
        </View>
      </Lap>
      <Szakasz ikon="nyugta" cim={P.account.card} />
      <Lap style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        <View style={{ paddingLeft: 38 }}>
          <T m={16} s={600} lh={1.45}>
            {d.cardLabel ?? 'Nincs mentett kártyád'}
          </T>
          <T m={15} lh={1.45} c={szin.halvany} style={{ marginTop: 2 }}>
            A fizetés a Stripe biztonságos oldalán történik. Ha a bankod megerősítést kér, ott adod meg.
          </T>
          <GombM cim={P.fizesdKi.otherCard} onPress={() => { setBe(false); setHiba(null); setMasik(true); }} style={{ marginTop: 12 }} />
          <HibaSzoveg szoveg={masik ? null : hiba} />
        </View>
      </Lap>
      <AlsoLap lathato={masik} bezar={() => setMasik(false)}>
        <View style={{ paddingTop: 8 }}>
          <T m={21} s={650} ls={-0.02} lh={1.25} style={{ paddingRight: 90 }} accessibilityRole="header">
            {P.fizesdKi.otherCard}
          </T>
          <T m={15.5} lh={1.5} c={szin.halvany} style={{ marginTop: 6, marginBottom: 10 }}>
            Az új kártya lesz a mentett kártyád, a következő levonás is erről megy.
          </T>
          {engedely.data ? <KartyaEngedely c={engedely.data} be={be} valt={setBe} /> : engedely.error ? <Hiba hiba={engedely.error} ujra={() => void engedely.refetch()} /> : <Betolt />}
          <HibaSzoveg szoveg={hiba} />
          <GombE cim={engedely.data ? engedelyGomb({ ...engedely.data, amountNowHuf: d.amountHuf }) : CARD_CONSENT_UI.buttonNoAmount} tolt={tolt} disabled={!be} onPress={() => void fizet(true)} style={{ marginTop: 16 }} />
          <GombSz cim="Mégse" onPress={() => setMasik(false)} style={{ alignSelf: 'center', marginTop: 4 }} />
        </View>
      </AlsoLap>
    </Kepernyo>
  );
}

function Sav({ cim, szoveg }: { cim: string; szoveg: string }) {
  return (
    <Fejlec rozX={318} rozY={110} alsoTer={22}>
      <View style={{ flexDirection: 'row', alignItems: 'center', minHeight: 44, paddingHorizontal: 16, paddingRight: 70 }}>
        <SavVissza onPress={() => vissza('/')} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 12, paddingHorizontal: 16 }}>
        <Ikon3d nev="szamlaszam" pt={30} />
        <T m={26} maxFontSizeMultiplier={1.4} s={700} lh={1.15} ls={-0.022} c="#fff" szam style={{ flexShrink: 1 }} accessibilityRole="header">
          {cim}
        </T>
      </View>
      <T m={16} lh={1.45} c={szin.fejlecHalvany} style={{ marginTop: 6, paddingLeft: 54, paddingRight: 16 }}>
        {szoveg}
      </T>
    </Fejlec>
  );
}
