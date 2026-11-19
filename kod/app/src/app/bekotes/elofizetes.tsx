// Előfizetés (FUNKCIOK 3): mit kapsz havi 19 999 Ft-ért; a token paraméterei érthetően; a SimplePay két kötelező
// nyilatkozata; a SimplePay tájékoztató linkje; „Kártyás fizetés” → böngésző. DEMO módban jól látható jelzés.
import { useState } from 'react';
import { STEP_LOCK_DEFAULT_TEXTS } from '@/_shared/bekotes';
import { LOCK_ELOFIZETES_SZERZODES_UTAN } from '@/_shared/enums';
import { Linking, View } from 'react-native';
import { ApiHiba } from '@/api/http';
import { useConfig, useElofizetes, useJogi, useOnboarding } from '@/api/hooks';
import { brand } from '@/config';
import { datumEvvel, napHozzaad, szam } from '@/lib/format';
import { kartyasFizetes } from '@/lib/simplepay';
import { szin } from '@/theme/tokens';
import { GombE, GombM, GombSz, HibaSzoveg, Lap, Pipa, Felsorolas } from '@/ui/alap';
import { ma } from '@/ui/ido';
import { KeszJel } from '@/ui/kepek';
import { CimSor, Kepernyo, vissza } from '@/ui/keret';
import { MiEz } from '@/ui/Magyarazat';
import { Elakadtal } from '@/ui/Visszahivas';
import { Ikon3d } from '@/ui/kepek';
import { T } from '@/ui/T';
import { szoveg, szovegLista } from '@/lib/szovegek';
import { DemoFizetesJel } from '@/ui/DemoJel';
import { hibaUzenet } from '@/lib/hiba';

function Nyilatkozat({ tipus, be, valt, cim }: { tipus: string; be: boolean; valt: (b: boolean) => void; cim: string }) {
  const j = useJogi(tipus);
  const [nyitva, setNyitva] = useState(false);
  return (
    <View style={{ marginTop: 6 }}>
      <Pipa be={be} valt={valt}>
        <T m={15.5} lh={1.45}>
          {cim}
        </T>
      </Pipa>
      <GombSz cim={nyitva ? 'Elrejtem a szöveget' : 'A teljes szöveg'} m={14.5} onPress={() => setNyitva((x) => !x)} style={{ marginLeft: 36, paddingVertical: 4 }} />
      {nyitva ? (
        <View style={{ marginLeft: 36, marginTop: 4, padding: 12, borderRadius: 12, backgroundColor: szin.nyomott }}>
          <T m={14} lh={1.5} c={szin.tinta}>
            {j.data?.markdown.replace(/[#*]/g, '').trim() ?? (j.isLoading ? 'Betöltjük…' : 'Most nem sikerült betölteni a szöveget.')}
          </T>
        </View>
      ) : null}
    </View>
  );
}

export default function Elofizetes() {
  const cfg = useConfig();
  const elo = useElofizetes();
  const o = useOnboarding();
  const [adat, setAdat] = useState(false);
  const [ism, setIsm] = useState(false);
  const [tolt, setTolt] = useState(false);
  const [hiba, setHiba] = useState<string | null>(null);
  const ar = cfg.data?.brand.priceHufMonthlyGross || brand.priceHufMonthlyGross;
  const acc = o.data?.accountant;
  const aktiv = elo.data?.status === 'active';
  const demo = cfg.data?.simplepayMode === 'demo';
  // a backend /config: simplepayEnabled=false → éles módban nincs kulcs, a fizetés ki van kapcsolva (SPEC §9.7, §24)
  const kikapcsolva = (cfg.data as { simplepayEnabled?: boolean } | undefined)?.simplepayEnabled === false;
  const vege = datumEvvel(napHozzaad(ma(), 365));

  async function fizet() {
    if (!adat || !ism) return setHiba('A fizetéshez mindkét nyilatkozatot el kell fogadnod.');
    setHiba(null);
    setTolt(true);
    try {
      await kartyasFizetes();
    } catch (e) {
      setHiba(hibaUzenet(e, 'Nem sikerült elindítani a fizetést.'));
    } finally {
      setTolt(false);
    }
  }

  // SPEC §26.1.7: új vállalkozásnál a kártyát csak az adószám után kérjük (a szerver 409 'step_locked'-del is véd).
  const lepes0 = o.data?.steps.find((x) => x.step === 'elofizetes');
  // SPEC §27.4.2: mindkét úton a szerződés után (a szerver zárja; régebbi szervernél itt is).
  const szerzodesNincs = !!o.data && o.data.steps.find((x) => x.step === 'szerzodes')?.status !== 'kesz' && lepes0?.status !== 'kesz';
  const lepes = lepes0 && !lepes0.locked && szerzodesNincs ? { ...lepes0, locked: true, lockedReason: STEP_LOCK_DEFAULT_TEXTS[LOCK_ELOFIZETES_SZERZODES_UTAN] } : lepes0;
  if (lepes?.locked) {
    return (
      <Kepernyo ful="fooldal" fejlec={<CimSor visszaCim="Vissza a Főoldalra" vissza={() => vissza('/bekotes')} cim="Előfizetés" al={`Havi ${szam(ar)} Ft, bruttó. Bármikor lemondhatod.`} />}>
        <Lap style={{ padding: 18 }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Ikon3d nev="lakat" pt={44} label="Zárolva" />
            <T m={17} s={600} lh={1.45} style={{ flex: 1 }}>
              {lepes.lockedReason ?? 'Akkor kérjük a kártyádat, ha már megvan az adószámod. Addig minden ingyenes.'}
            </T>
          </View>
          <MiEz kulcs="elofizetes" style={{ alignSelf: 'flex-start', marginTop: 8 }} />
        </Lap>
        <Elakadtal forras="elofizetes" tema="elofizetes" style={{ marginTop: 6, marginLeft: 4 }} />
      </Kepernyo>
    );
  }

  return (
    <Kepernyo ful="fooldal" fejlec={<CimSor visszaCim="Vissza a Főoldalra" vissza={() => vissza('/bekotes')} cim="Előfizetés" al={`Havi ${szam(ar)} Ft, bruttó. Bármikor lemondhatod.`} />}>
      <MiEz kulcs="elofizetes" style={{ alignSelf: 'flex-start', marginLeft: 4, marginBottom: 6 }} />
      {demo ? <DemoFizetesJel /> : null}
      <Lap style={{ padding: 18 }}>
        <T m={17} s={650} lh={1.4}>
          Mit kapsz ezért?
        </T>
        <Felsorolas
          elemek={[
            ...szovegLista('ar.mit_kapsz', {}, ['Saját könyvelő, aki név szerint ismer.', 'Kiszámolja, mennyit kell fizetned, és beadja a bevallásaidat.']),
            ...(acc?.responseTimeText ? [`${acc.firstName}: ${acc.responseTimeText.charAt(0).toLowerCase()}${acc.responseTimeText.slice(1)}.`] : []),
          ]}
        />
      </Lap>

      {aktiv ? (
        <Lap style={{ padding: 18, marginTop: 12 }}>
          <T m={17} s={650} lh={1.4}>
            Az előfizetésed él.
          </T>
          <T m={15} c={szin.halvany} lh={1.5} style={{ marginTop: 4, marginBottom: 14 }}>
            A kártyád: {elo.data?.card?.mask ?? '–'}. A részleteket a Fiók oldalon látod.
          </T>
          <GombM cim="Vissza a bekötéshez" onPress={() => vissza('/bekotes')} />
        </Lap>
      ) : (
        <Lap style={{ padding: 18, marginTop: 12 }}>
          <T m={17} s={650} lh={1.4}>
            Így működik a havidíj
          </T>
          <T m={15.5} lh={1.5} style={{ marginTop: 6 }}>
            Most kifizeted az első hónapot, és a kártyádat elmentjük a SimplePay-nél. Utána havonta egyszer, legfeljebb {szam(ar)} Ft-ot vonunk le.
          </T>
          <View style={{ marginTop: 10, borderRadius: 12, backgroundColor: szin.nyomott, padding: 12 }}>
            <T m={15} lh={1.5}>
              {szoveg('megujulas.engedely', { 'elofizetes.lejarat_ig': `${vege.replace(/\.$/, '')}-ig`, 'elofizetes.max_osszeg': `${szam(ar)} Ft` }, `12 alkalommal, legfeljebb ${szam(ar)} Ft, ${vege.replace(/\.$/, '')}-ig vonhatunk le a kártyádról. Bármikor törölheted a kártyádat a Fiók oldalon.`)}
            </T>
          </View>
          <Nyilatkozat tipus="simplepay_adattovabbitas" be={adat} valt={setAdat} cim={szoveg('szerzodes.simplepay_adattovabbitas', {}, 'Elfogadom az adattovábbítási nyilatkozatot.')} />
          <Nyilatkozat tipus="simplepay_ismetlodo" be={ism} valt={setIsm} cim={szoveg('szerzodes.simplepay_ismetlodo', {}, 'Elfogadom az ismétlődő bankkártyás fizetés feltételeit.')} />
          {kikapcsolva ? (
            <T m={15} s={600} c={szin.veszely} lh={1.45} style={{ marginTop: 12 }}>
              A kártyás fizetés még nincs bekapcsolva. Amint elindul, szólunk.
            </T>
          ) : null}
          <HibaSzoveg szoveg={hiba} />
          <GombE cim={szoveg('fizetes.gomb', {}, 'Kártyás fizetés')} onPress={fizet} tolt={tolt} disabled={!adat || !ism || kikapcsolva} style={{ marginTop: 16 }} />
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 10 }}>
            <GombSz cim={szoveg('fizetes.simplepay_link', {}, 'Fizetési tájékoztató (SimplePay)')} m={13.5} onPress={() => void Linking.openURL('https://simplepay.hu/fizetesi-tajekoztato/')} />
          </View>
          <T m={13.5} c={szin.halvany} lh={1.45} kozep style={{ marginTop: 4 }}>
            {szoveg('fizetes.biztonsag', {}, 'A fizetés a SimplePay oldalán történik. A kártyád számát mi nem látjuk.')}
          </T>
        </Lap>
      )}
      <Elakadtal forras="elofizetes" tema="elofizetes" style={{ marginTop: 6, marginLeft: 4 }} />
    </Kepernyo>
  );
}
