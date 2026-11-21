// SPEC §32 – közös fizetési lap (/fizetes/[id]): minden jóváhagyott befizetésre ugyanaz (kata-hónap, negyedév,
// iparűzési adóelőleg). Tételenként kedvezményezett, számlaszám, közlemény, összeg „Másolom” gombokkal, alul
// „Megjelölöm, hogy befizettem” – ez csak jelölés: pénzt nem vonunk le, nem utalunk. A könyvelő ellenőrzi.
import { useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import type { PaymentItem } from '@/_shared/api';
import { fillPlaceholders } from '@/_shared/bekotes';
import { PAYMENT_SHEET_TEXTS as P } from '@/_shared/kata';
import { useBefizettem, useHome, useIdoszak, useMegsemFizettem } from '@/api/hooks';
import { allapotMondat, fizetesAllapot, fizetesFej, masolando, nyitottTetelek } from '@/lib/kata';
import { datumRovid, napHozzaad, szam } from '@/lib/format';
import { hibaUzenet } from '@/lib/hiba';
import { datumHiba, datumNormal } from '@/lib/validators';
import { MASOLAS_HIBA, vagolapra } from '@/lib/vagolap';
import { forma, szin } from '@/theme/tokens';
import { GombE, GombM, GombSz, HibaSzoveg, Lap, Szakasz } from '@/ui/alap';
import { ma } from '@/ui/ido';
import { KeszJel } from '@/ui/kepek';
import { AlsoLap, Betolt, CimSor, Hiba, Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { Mezo } from '@/ui/Mezo';
import { T } from '@/ui/T';
import { ZaroltKapu } from '@/ui/Zarolt';

function MasolGomb({ ertek, mit, tetel }: { ertek: string; mit: string; tetel: string }) {
  const jelez = useJelzes();
  const [kesz, setKesz] = useState(false);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${tetel}: ${mit} másolása`}
      onPress={async () => {
        // Csak akkor „Kimásoltuk”, ha tényleg a vágólapon van – különben a banki appba a korábbi tartalom kerülne.
        if (!(await vagolapra(ertek))) return jelez(MASOLAS_HIBA);
        if (Platform.OS !== 'web') void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
        setKesz(true);
        jelez({ szoveg: `${P.kimasoltuk}: ${mit}`, kesz: true });
      }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', height: 36, paddingHorizontal: 13, borderRadius: forma.gomb, backgroundColor: pressed ? szin.gombMNyomott : szin.gombMAlap })}
    >
      <T m={14.5} s={650} c={szin.tintakekSzoveg}>
        {kesz ? P.kimasoltuk : P.masolom}
      </T>
    </Pressable>
  );
}

function Adat({ cim, ertek, masol, tetel, elso }: { cim: string; ertek: string; masol?: string; tetel: string; elso?: boolean }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: elso ? 0 : 1, borderTopColor: szin.hajszal }}>
      <View style={{ flex: 1, minWidth: 0 }}>
        <T m={13.5} c={szin.halvany} lh={1.3}>
          {cim}
        </T>
        <T m={16.5} s={600} lh={1.35} szam selectable>
          {ertek}
        </T>
      </View>
      {masol !== undefined ? <MasolGomb ertek={masol} mit={cim.toLowerCase()} tetel={tetel} /> : null}
    </View>
  );
}

function Tetel({ t }: { t: PaymentItem }) {
  return (
    <Lap style={{ paddingHorizontal: 16, paddingVertical: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, paddingTop: 8, paddingBottom: 4 }}>
        <T m={17} s={650} lh={1.3} style={{ flexShrink: 1 }}>
          {t.label}
          {t.sublabel ? <T m={14} c={szin.halvany}>{` · ${t.sublabel}`}</T> : null}
        </T>
        {t.markedPaidAt ? <KeszJel pt={22} /> : null}
      </View>
      <Adat elso cim={P.osszeg} ertek={`${szam(t.amountHuf)} Ft`} masol={masolando('osszeg', t)} tetel={t.label} />
      <Adat cim={P.kedvezmenyezett} ertek={t.accountName} tetel={t.label} />
      <Adat cim={P.szamlaszam} ertek={t.accountNumber} masol={masolando('szamlaszam', t)} tetel={t.label} />
      <Adat cim={P.kozlemeny} ertek={t.reference || '–'} masol={t.reference ? masolando('kozlemeny', t) : undefined} tetel={t.label} />
    </Lap>
  );
}

function FizetesTartalom() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const q = useIdoszak(id);
  const home = useHome();
  const jelol = useBefizettem();
  const megse = useMegsemFizettem();
  const jelez = useJelzes();
  const fn = home.data?.accountant.firstName ?? 'A könyvelőd';
  const [lap, setLap] = useState(false);
  const [mikor, setMikor] = useState<'ma' | 'tegnap' | 'mas'>('ma');
  const [masNap, setMasNap] = useState('');
  const [hiba, setHiba] = useState<string | null>(null);
  const fej = <CimSor visszaCim={P.vissza} vissza={() => vissza('/hataridok')} cim={q.data ? fizetesFej(q.data, ma()).cim : 'Befizetés'} al={q.data ? fizetesFej(q.data, ma()).al : undefined} />;
  if (q.isLoading) return <Kepernyo ful="fooldal" fejlec={fej}><Betolt /></Kepernyo>;
  if (q.error || !q.data) return <Kepernyo ful="fooldal" fejlec={fej}><Hiba hiba={q.error} ujra={() => void q.refetch()} /></Kepernyo>;
  const d = q.data;
  const allapot = fizetesAllapot(d);
  const f = fizetesFej(d, ma());
  const mondat = allapotMondat(allapot, fn, d.exemptReasonLabel);
  const mutatTetelek = allapot === 'fizetendo' || allapot === 'jelolve' || allapot === 'elteres' || allapot === 'rendben';
  const nyitott = nyitottTetelek(d.items);

  async function feljegyez() {
    const nap = mikor === 'ma' ? ma() : mikor === 'tegnap' ? napHozzaad(ma(), -1) : datumNormal(masNap);
    if (mikor === 'mas') {
      const h = datumHiba(nap);
      if (h) return setHiba(h);
      if (nap > ma()) return setHiba('Jövőbeli napot nem jelölhetsz.');
    }
    setHiba(null);
    try {
      await jelol.mutateAsync({ id: d.id, paidOn: nap });
      setLap(false);
      jelez({ szoveg: fillPlaceholders(P.jelolve, { firstName: fn }), kesz: true });
      void q.refetch();
    } catch (e) {
      setHiba(hibaUzenet(e, 'Nem sikerült megjelölni. Próbáld újra.'));
    }
  }

  const dokk =
    allapot === 'fizetendo' ? (
      <GombE cim={P.jeloles} onPress={() => setLap(true)} />
    ) : allapot === 'elteres' ? (
      <GombE cim={P.elteresGomb} onPress={() => router.push('/uzenetek')} />
    ) : undefined;

  return (
    <Kepernyo ful="fooldal" fejlec={<CimSor visszaCim={P.vissza} vissza={() => vissza('/hataridok')} cim={f.cim} al={mutatTetelek && allapot !== 'rendben' ? f.al : undefined} />} dokk={dokk}>
      {f.tobb && allapot === 'fizetendo' ? (
        <T m={15.5} lh={1.45} c={szin.halvany} style={{ paddingHorizontal: 4 }}>
          {f.tobb}
        </T>
      ) : null}
      {mondat ? (
        <Lap style={{ paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', gap: 10, alignItems: 'center' }}>
          {allapot === 'rendben' || allapot === 'mentes' ? <KeszJel pt={24} /> : null}
          <T m={16.5} s={600} lh={1.45} style={{ flex: 1 }}>
            {mondat}
          </T>
        </Lap>
      ) : null}
      {allapot === 'jelolve' ? (
        <GombSz
          cim={P.megse}
          style={{ alignSelf: 'flex-start', marginLeft: 4 }}
          onPress={async () => {
            try {
              await megse.mutateAsync({ id: d.id });
              void q.refetch();
            } catch (e) {
              jelez(hibaUzenet(e, 'Nem sikerült. Próbáld újra.'));
            }
          }}
        />
      ) : null}
      {mutatTetelek ? (
        <>
          <Szakasz cim={P.kozlemenyTipp} ikon="szamlaszam" />
          {(allapot === 'fizetendo' ? nyitott : d.items).map((t) => (
            <Tetel key={t.id} t={t} />
          ))}
          {allapot === 'fizetendo' ? (
            <T m={14.5} lh={1.45} c={szin.halvany} style={{ paddingHorizontal: 4 }}>
              {P.jelolesAl}
            </T>
          ) : null}
        </>
      ) : null}
      <AlsoLap lathato={lap} bezar={() => setLap(false)}>
        <T m={22} s={700} lh={1.25} style={{ paddingRight: 84 }} accessibilityRole="header">
          {P.mikor}
        </T>
        <T m={15} lh={1.5} c={szin.halvany} style={{ marginTop: 6 }}>
          {P.jelolesAl}
        </T>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap', marginTop: 14 }} accessibilityRole="radiogroup" aria-label={P.mikor}>
          {(
            [
              ['ma', `Ma, ${datumRovid(ma())}`],
              ['tegnap', 'Tegnap'],
              ['mas', 'Másik nap'],
            ] as const
          ).map(([k, c]) => (
            <Pressable
              key={k}
              accessibilityRole="radio"
              accessibilityState={{ selected: mikor === k, checked: mikor === k }}
              aria-checked={mikor === k}
              aria-label={`${P.mikor} ${c}`}
              onPress={() => {
                setMikor(k);
                setHiba(null);
              }}
              style={{ height: 40, paddingHorizontal: 14, borderRadius: forma.mezo, borderWidth: mikor === k ? 2 : 1, borderColor: mikor === k ? szin.tintakek : szin.keret, justifyContent: 'center', backgroundColor: mikor === k ? '#fff' : szin.mezoAlap }}
            >
              <T m={15} s={mikor === k ? 650 : 500}>
                {c}
              </T>
            </Pressable>
          ))}
        </View>
        {mikor === 'mas' ? (
          <Mezo felirat="A nap" placeholder="ÉÉÉÉ-HH-NN" value={masNap} onChangeText={(v) => { setMasNap(v); setHiba(null); }} keyboardType="numbers-and-punctuation" style={{ marginTop: 12 }} />
        ) : null}
        <HibaSzoveg szoveg={hiba} />
        <GombE cim={P.jelolesGomb} onPress={() => void feljegyez()} tolt={jelol.isPending} style={{ marginTop: 18 }} />
        <GombM cim="Mégse" style={{ marginTop: 8 }} onPress={() => setLap(false)} />
      </AlsoLap>
    </Kepernyo>
  );
}

/** SPEC §26.5: bekötés alatt zárolt (adóadat). */
export default function Fizetes() {
  return (
    <ZaroltKapu feature="hataridok" ful="fooldal" cim="Befizetés">
      <FizetesTartalom />
    </ZaroltKapu>
  );
}
