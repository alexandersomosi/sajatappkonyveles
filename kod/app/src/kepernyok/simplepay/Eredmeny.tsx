// SPEC §29.1.12: the SimplePay variant of this screen, kept for PAYMENT_PROVIDER=simplepay (never deleted, off by default).
// Moved here unchanged from the route file in k7 (B3); the route now shows the Stripe / DEMO screen.
// SimplePay eredmény (SPEC §9.5): a kötelező szövegek a tranzakció-azonosítóval. A pénz állapotát a szerver dönti el
// (IPN); itt csak megmutatjuk, és frissítjük az előfizetést. Ide jön a kezjegy://elofizetes/eredmeny és a webes vissza-cím.
// k3_kor2 biztonság 14: a „Sikeres” állapot CSAK akkor látszik, ha a szerver szerint él az előfizetés – az URL-ből nem
// (kezjegy://elofizetes/eredmeny?e=SUCCESS hamisítható). Addig „Ellenőrizzük a fizetést”.
import { useEffect, useState } from 'react';
import { ActivityIndicator } from 'react-native';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { K, useConfig, useElofizetes } from '@/api/hooks';
import { szin } from '@/theme/tokens';
import { GombE, GombSz, Lap, jelzoDoboz } from '@/ui/alap';
import { Ikon3d, KeszJel } from '@/ui/kepek';
import { CimSor, Kepernyo } from '@/ui/keret';
import { T } from '@/ui/T';
import { szoveg } from '@/lib/szovegek';

export function SimplePayEredmeny() {
  const p = useLocalSearchParams<{ e?: string; t?: string; eredmeny?: string }>();
  const qc = useQueryClient();
  const elo = useElofizetes();
  const cfg = useConfig();
  // DEMO payment (no SimplePay contract yet): say so, the transaction id below is a made-up one.
  const demoFizetes = cfg.data?.simplepayMode === 'demo' || elo.data?.mode === 'demo';
  const e = (p.e ?? p.eredmeny ?? '').toUpperCase();
  const t = p.t ?? '';
  const [lejart, setLejart] = useState(false);
  useEffect(() => {
    void qc.invalidateQueries({ queryKey: K.elofizetes });
    void qc.invalidateQueries({ queryKey: K.onboarding });
    const i = setInterval(() => void qc.invalidateQueries({ queryKey: K.elofizetes }), 4000);
    const v = setTimeout(() => {
      clearInterval(i);
      setLejart(true);
    }, 40_000);
    return () => {
      clearInterval(i);
      clearTimeout(v);
    };
  }, [qc]);
  const aktiv = elo.data?.status === 'active';
  // Csak a szerver visszaigazolása után „sikeres”; a SUCCESS az URL-ben csak annyit jelent: várjuk a visszaigazolást.
  const varjuk = e === 'SUCCESS' && !aktiv;
  const siker = e === 'SUCCESS' && aktiv;
  const cim = siker ? 'Sikeres tranzakció' : varjuk ? 'Ellenőrizzük a fizetést' : e === 'CANCEL' ? 'Megszakítottad a fizetést' : e === 'TIMEOUT' ? 'Lejárt az idő' : 'Sikertelen tranzakció';
  const tr = { 'simplepay.tranzakcio': t || '–' };
  return (
    <Kepernyo ful="fooldal" fejlec={<CimSor cim={cim} />}>
      {demoFizetes ? (
        <View style={{ borderRadius: 14, ...jelzoDoboz('figyelem'), padding: 14, marginBottom: 12 }}>
          <T m={15} s={650} c={szin.borostyanSzoveg} lh={1.45}>
            DEMO FIZETÉS: ez nem valódi SimplePay-tranzakció, kártyát nem terheltünk, pénz nem mozdult. Az azonosító is kitalált.
          </T>
        </View>
      ) : null}
      <Lap style={{ padding: 18 }}>
        {siker ? (
          <View style={{ alignItems: 'center', marginBottom: 8 }}>
            <KeszJel pt={84} label="Sikeres fizetés" />
          </View>
        ) : varjuk ? (
          <View style={{ alignItems: 'center', marginBottom: 8, minHeight: 72, justifyContent: 'center' }}>
            {lejart ? <Ikon3d nev="ora" pt={72} /> : <ActivityIndicator color={szin.tintakek} size="large" />}
          </View>
        ) : (
          <View style={{ alignItems: 'center', marginBottom: 8 }}>
            <Ikon3d nev="szamlaszam" pt={72} />
          </View>
        )}
        {siker ? (
          <T m={16} lh={1.55}>
            {szoveg('fizetes.siker', tr, `Sikeres tranzakció. SimplePay tranzakcióazonosító: ${t}`)}
          </T>
        ) : varjuk ? (
          <T m={16} lh={1.55}>
            {lejart
              ? 'Még nem kaptuk meg a fizetés visszaigazolását. Ha a kártyádat terhelték, nem kell újra fizetned: írj nekünk, és megnézzük.'
              : 'A SimplePay visszaigazolását várjuk, ez pár másodperc. Ne zárd be ezt a lapot.'}
          </T>
        ) : e === 'CANCEL' ? (
          <T m={16} lh={1.55}>
            {szoveg('fizetes.megszakitva', tr, 'Megszakítottad a fizetést.')}
          </T>
        ) : e === 'TIMEOUT' ? (
          <T m={16} lh={1.55}>
            {szoveg('fizetes.idotullepes', tr, 'Lejárt a tranzakció maximális ideje.')}
          </T>
        ) : (
          <T m={16} lh={1.55}>
            {szoveg('fizetes.sikertelen', tr, `Sikertelen tranzakció. SimplePay tranzakcióazonosító: ${t}.`)}
          </T>
        )}
        {siker ? (
          <T m={14.5} c={szin.halvany} lh={1.5} style={{ marginTop: 10 }}>
            Az előfizetésed él. A díjszámlát e-mailben is elküldjük.
          </T>
        ) : null}
        {varjuk ? (
          lejart ? <GombE cim="Írok nektek" onPress={() => router.replace('/uzenetek')} style={{ marginTop: 18 }} /> : null
        ) : (
          <GombE cim={siker ? 'Tovább' : 'Újra megpróbálom'} onPress={() => router.replace(siker ? '/bekotes' : '/bekotes/elofizetes')} style={{ marginTop: 18 }} />
        )}
        <GombSz cim="A Fiók oldalra" onPress={() => router.replace('/fiok/elofizetes')} style={{ alignSelf: 'center' }} />
      </Lap>
    </Kepernyo>
  );
}
