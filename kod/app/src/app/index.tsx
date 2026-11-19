// 03 Főoldal (FUNKCIOK 8–11): a sáv a nagy összeggel és a határidővel, a könyvelő levele, a három utalás,
// gyorsműveletek, a könyvelő kérései, idei keretek, idei bevétel, a havi dosszié. Állapotok: becslés, jóváhagyva,
// befizetve (08 állapot), nincs fizetendő; bekötés alatt a Bekötés képernyőre visz.
import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, useWindowDimensions, View } from 'react-native';
import { mozgasKi } from '@/lib/mozgas';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import type { ClientHome, DocumentListItem } from '@/_shared/api';
import { useElofizetesFolytat, useHome, useIdoszak, useKeresKesz, useMegsemFizettem } from '@/api/hooks';
import { Befizettem, feljegyezveSzoveg, HogyanJottKi, Szamlaszamok } from '@/kepernyok/fizetes';
import { becslesFej, datumAn, datumE, datumIg, datumRovid, hataridoSav, hatraVan, honapMelleknev, mikor, mindElutaltad, nagybetu, szam, utalasFej } from '@/lib/format';
import { szin } from '@/theme/tokens';
import { Allapot, Cimke, Fejlec, GombE, GombM, GombSav, GombSz, Lap, Osszeg, Sor, Szakasz } from '@/ui/alap';
import { maBeallit } from '@/ui/ido';
import { Ikon3d, KeszJel, type Ikon3dNev } from '@/ui/kepek';
import { Betolt, demoBeallit, Hiba, Kepernyo, useJelzes } from '@/ui/keret';
import { Level } from '@/ui/Level';
import { Elakadtal } from '@/ui/Visszahivas';
import { BevetelOszlopok, Mero, PipaMondat } from '@/ui/Mero';
import { T } from '@/ui/T';
import { hibaUzenet } from '@/lib/hiba';
import { fillPlaceholders, JOURNEY_TEXTS } from '@/_shared/bekotes';
import { beallitasIr, beallitasOlvas } from '@/lib/tarolo';

/** S25 – egyszeri kártya az első aktív Főoldalon: „Kész a bekötés!” (SPEC §27.4.4). Csak ezen a telefonon jegyzi meg. */
function AktivalasKartya({ ugyfel, fn }: { ugyfel: string; fn: string }) {
  const kulcs = `kj_aktiv_kartya_${ugyfel}`;
  const [lathato, setLathato] = useState(false);
  useEffect(() => {
    void beallitasOlvas(kulcs).then((v) => setLathato(!v)).catch(() => undefined);
  }, [kulcs]);
  if (!lathato) return null;
  return (
    <Lap style={{ padding: 18, marginBottom: 12 }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <KeszJel pt={40} />
        <T m={20} s={700} lh={1.3} style={{ flex: 1 }} accessibilityRole="header">
          {JOURNEY_TEXTS.activeTitle}
        </T>
      </View>
      <T m={16} lh={1.5} c={szin.halvany} style={{ marginTop: 8 }}>
        {fillPlaceholders(JOURNEY_TEXTS.activeBody, { firstName: fn })}
      </T>
      <GombM
        cim="Rendben"
        style={{ marginTop: 12 }}
        onPress={() => {
          setLathato(false);
          void beallitasIr(kulcs, '1');
        }}
      />
    </Lap>
  );
}

type LapNev = null | 'hogyan' | 'szamlaszamok' | 'befizettem';

function Sav({ h, lap }: { h: ClientHome; lap: (l: LapNev) => void }) {
  const hero = h.hero;
  // The big amount must never break inside the number ("305 04 / 6 Ft" at 320 px with large text, review k3c2).
  const keskeny = useWindowDimensions().width < 360;
  // TERV §6: 240 ms-os áttűnés, amikor az összeg „Befizetted”-re vált (csökkentett mozgásnál nincs).
  const attunes = useRef(new Animated.Value(1)).current;
  const elozoAllapot = useRef(hero.state);
  useEffect(() => {
    if (elozoAllapot.current === hero.state) return;
    elozoAllapot.current = hero.state;
    void mozgasKi().then((rm) => {
      if (rm) return;
      attunes.setValue(0);
      Animated.timing(attunes, { toValue: 1, duration: 240, useNativeDriver: Platform.OS !== 'web' }).start();
    });
  }, [hero.state, attunes]);
  const ft = (
    <T m={56 * 0.42} s={600} c={szin.fejlecHalvany} ls={-0.01}>
      {' Ft'}
    </T>
  );
  return (
    <Fejlec rozX={150} rozY={92} alsoTer={16}>
      <Animated.View style={{ opacity: attunes }}>
      {hero.state === 'befizetve' ? (
        <View style={{ paddingTop: 6, paddingHorizontal: 20 }}>
          <T m={52} s={800} lh={1.1} ls={-0.035} c="#fff" accessibilityRole="header">
            Befizetted
          </T>
          <T m={17} lh={1.4} c="#fff" style={{ marginTop: 10 }}>
            <T m={17} c="#fff" szam>
              {szam(hero.amountHuf ?? 0)}
            </T>{' '}
            Ft, {hero.paidOn ? datumAn(hero.paidOn) : ''}.
          </T>
          <T m={15.5} lh={1.45} c={szin.fejlecHalvany} style={{ marginTop: 3 }}>
            {hero.verified ? `${h.accountant.firstName} látta a kivonatodon: megérkezett.` : `${h.accountant.firstName} a kivonatodon ellenőrzi.`}
          </T>
        </View>
      ) : hero.state === 'nincs_fizetendo' ? (
        <View style={{ paddingTop: 6, paddingHorizontal: 20 }}>
          <T m={40} s={800} lh={1.1} ls={-0.035} c="#fff" accessibilityRole="header">
            Most nincs mit fizetned
          </T>
          <T m={16} lh={1.45} c={szin.fejlecHalvany} style={{ marginTop: 8 }}>
            {hero.note ?? `${h.accountant.firstName} szól, amikor legközelebb fizetni kell.`}
          </T>
        </View>
      ) : (
        <>
          {hero.state === 'becsles' ? (
            <T m={15.5} lh={1.45} c={szin.fejlecHalvany} style={{ paddingTop: 10, paddingHorizontal: 20 }}>
              {hero.periodLabel ? `${nagybetu(hero.periodLabel)}, becslés` : 'Becslés'}
            </T>
          ) : null}
          <T m={keskeny ? 46 : 56} maxFontSizeMultiplier={1.1} s={800} lh={1.05} ls={-0.035} c="#fff" szam style={{ paddingTop: hero.state === 'becsles' ? 4 : 6, paddingHorizontal: 20 }} accessibilityRole="header" accessibilityLabel={`${hero.state === 'becsles' ? 'Eddig körülbelül ' : 'Befizetendő: '}${szam(hero.amountHuf ?? 0)} forint`}>
            {szam(hero.amountHuf ?? 0)}
            {ft}
          </T>
          {hero.dueDate ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 6, paddingTop: 9, paddingHorizontal: 20 }}>
              <T m={17} lh={1.4} c="#fff">
                {hero.state === 'becsles' ? `Befizetés ${hataridoSav(hero.dueDate).replace(/^./, (c) => c.toLowerCase())}` : hataridoSav(hero.dueDate)}
              </T>
              {hero.state === 'jovahagyva' && hero.daysLeft != null && hero.daysLeft <= 14 ? <Cimke szoveg={hatraVan(hero.daysLeft)} style={{ marginLeft: 6 }} /> : null}
            </View>
          ) : null}
          {hero.state === 'becsles' ? (
            <T m={15.5} lh={1.45} c={szin.fejlecHalvany} style={{ paddingTop: 3, paddingHorizontal: 20 }}>
              {hero.note ?? `${h.accountant.firstName} a negyedév végén véglegesíti.`}
            </T>
          ) : null}
        </>
      )}
      </Animated.View>
      {hero.periodId ? <GombSav cim="Hogyan jött ki?" ikon="szamolo" onPress={() => lap('hogyan')} style={{ marginTop: hero.state === 'befizetve' ? 16 : 12, marginLeft: 20 }} /> : null}
    </Fejlec>
  );
}

function FizetesLap({ h, lap }: { h: ClientHome; lap: (l: LapNev) => void }) {
  const megsem = useMegsemFizettem();
  const jelez = useJelzes();
  // Keskeny telefonon (360–375 pt) a két fő gomb egymás alá kerül: a feliratuk soha nem csonkolódhat.
  const { width } = useWindowDimensions();
  const keskeny = Math.min(width, 480) < 390;
  const t = h.paymentItems;
  if (!t.length) return null;
  const allapot = h.hero.state;
  const fizetve = allapot === 'befizetve';
  // Részben befizetve: a már jelölt tételek pipát kapnak, a fejléc azt mondja, mi van még hátra.
  const nyitott = t.filter((x) => !x.markedPaidAt);
  const reszben = allapot === 'jovahagyva' && nyitott.length > 0 && nyitott.length < t.length;
  const fej =
    allapot === 'becsles'
      ? becslesFej(t.length)
      : fizetve
        ? t.every((x) => x.markedPaidAt)
          ? mindElutaltad(t.length)
          : 'Ezeket jelölted befizetettnek'
        : reszben
          ? `Még hátra: ${nyitott.map((x) => x.label).join(', ')}, ${szam(nyitott.reduce((a, b) => a + b.amountHuf, 0))} Ft`
          : utalasFej(t.length);
  return (
    <Lap style={{ paddingTop: 11, paddingBottom: 10, marginTop: 12 }}>
      <T m={15} s={600} c={szin.halvany} style={{ paddingHorizontal: 18, paddingBottom: 2 }}>
        {fej}
      </T>
      {t.map((x0, i) => {
        // Jóváhagyott 03: „SZJA-előleg III. negyedév” egy sorban. Ha a szerver hosszú, magyarázó alcímet ad
        // („személyi jövedelemadó-előleg”), itt a negyedév neve áll – a teljes név a „Hogyan jött ki?” lapon olvasható –,
        // különben a harmadik sor is kétsoros lenne, és a gyorsműveletek a fülsor alá csúsznának.
        const x = x0.kind === 'szja_eloleg' && h.hero.periodLabel && (!x0.sublabel || x0.sublabel.length > 16) ? { ...x0, sublabel: h.hero.periodLabel } : x0;
        return (
        <View key={x.id} style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, paddingVertical: 8, paddingHorizontal: 18 }}>
          {i > 0 ? <View style={{ position: 'absolute', top: 0, left: 18, right: 18, height: 1, backgroundColor: szin.hajszal }} /> : null}
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              {allapot !== 'becsles' && x.markedPaidAt ? (
                <View style={{ marginRight: 7 }}>
                  <KeszJel pt={21} />
                </View>
              ) : null}
              <T m={16} s={500} lh={1.3}>
                {x.label}
                {x.sublabel && x.sublabel.length <= 16 ? (
                  <T m={14} c={szin.halvany}>
                    {' '}
                    {x.sublabel}
                  </T>
                ) : null}
              </T>
            </View>
            {x.sublabel && x.sublabel.length > 16 ? (
              <T m={13.5} c={szin.halvany} lh={1.35} style={{ marginTop: 1 }}>
                {x.sublabel}
              </T>
            ) : null}
            {reszben && x.markedPaidAt ? (
              <T m={13.5} c={szin.halvany} lh={1.35} style={{ marginTop: 1 }}>
                {`Befizetted${x.markedPaidOn ? `, ${datumRovid(x.markedPaidOn)}` : ''}`}
              </T>
            ) : null}
          </View>
          <View style={{ flexShrink: 0 }}>
            <Osszeg szoveg={szam(x.amountHuf)} />
          </View>
        </View>
        );
      })}
      {allapot === 'jovahagyva' ? (
        <View style={{ flexDirection: keskeny ? 'column' : 'row', gap: 10, paddingTop: 8, paddingHorizontal: keskeny ? 16 : 18 }}>
          <GombE cim="Számlaszámok" magas={50} onPress={() => lap('szamlaszamok')} style={keskeny ? { paddingHorizontal: 14 } : { flex: 1, paddingHorizontal: 14 }} />
          <GombM cim="Már befizettem" magas={50} onPress={() => lap('befizettem')} style={keskeny ? { alignSelf: 'stretch', paddingHorizontal: 14 } : { flex: 1, alignSelf: 'auto', paddingHorizontal: 14 }} />
        </View>
      ) : null}
      {fizetve ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', columnGap: 10, paddingTop: 8, paddingHorizontal: 18 }}>
          <T m={14.5} c={szin.halvany}>
            {feljegyezveSzoveg(t.find((x) => x.markedPaidAt)?.markedPaidAt)}
          </T>
          {h.hero.verified ? null : (
            <GombSz
              cim="Mégsem fizettem be"
              m={15}
              style={{ paddingVertical: 4 }}
              onPress={async () => {
                if (!h.hero.periodId) return;
                try {
                  await megsem.mutateAsync({ id: h.hero.periodId });
                  jelez('Visszavontuk: még nem fizetted be.');
                } catch {
                  jelez('Nem sikerült. Próbáld újra.');
                }
              }}
            />
          )}
        </View>
      ) : null}
      {allapot === 'becsles' ? (
        <T m={14.5} c={szin.halvany} lh={1.45} style={{ paddingTop: 8, paddingHorizontal: 18 }}>
          Még ne utald el: {h.accountant.firstName} a negyedév végén véglegesíti, és szól, mennyit kell fizetned.
        </T>
      ) : null}
    </Lap>
  );
}

const GYORS: { cim: string; ikon: Ikon3dNev; pt: number; alja: number; ut: string }[] = [
  { cim: 'Feltöltés', ikon: 'feltoltes', pt: 54, alja: -3.8, ut: '/feltoltes' },
  { cim: 'Kérdezek', ikon: 'kerdezek', pt: 50, alja: -7.4, ut: '/uzenetek' },
  { cim: 'Igazolás', ikon: 'igazolas', pt: 58, alja: -4.1, ut: '/keresek/uj' },
  { cim: 'Határidők', ikon: 'hataridok', pt: 54, alja: -6.4, ut: '/hataridok' },
];
function Gyorsgombok() {
  return (
    <View style={{ flexDirection: 'row', backgroundColor: szin.lap, borderRadius: 18, paddingTop: 10, paddingBottom: 10, paddingHorizontal: 4, marginTop: 12 }} accessibilityRole="menu">
      {GYORS.map((g) => (
        <Pressable key={g.cim} accessibilityRole="button" accessibilityLabel={g.cim} onPress={() => router.push(g.ut as never)} style={({ pressed }) => [{ flex: 1, alignItems: 'center', gap: 7 }, pressed && { opacity: 0.7 }]}>
          <View style={{ height: 50, width: '100%', alignItems: 'center', justifyContent: 'flex-end' }}>
            <Ikon3d nev={g.ikon} pt={g.pt} arnyektalan={false} style={{ marginBottom: g.alja }} />
          </View>
          <T m={13.5} s={500} lh={1.2} kozep ls={-0.005}>
            {g.cim}
          </T>
        </Pressable>
      ))}
    </View>
  );
}

/** „Kész, elküldtem”: ha üzenetben vagy máshogy már elküldted, a kérést te zárod le (SPEC §6.4). */
function KeresKeszGomb({ id, fn }: { id: string; fn: string }) {
  const kesz = useKeresKesz();
  const jelez = useJelzes();
  return (
    <GombSz
      cim={kesz.isPending ? 'Egy pillanat…' : 'Kész, már elküldtem'}
      m={15}
      style={{ alignSelf: 'flex-start', marginTop: 6, paddingBottom: 0 }}
      onPress={async () => {
        try {
          await kesz.mutateAsync({ id });
          jelez({ szoveg: `Lezártad. ${fn} látja, hogy elküldted.`, kesz: true });
        } catch (e) {
          jelez(hibaUzenet(e, 'Nem sikerült. Próbáld újra.'));
        }
      }}
    />
  );
}

export function iratAllapot(d: DocumentListItem, ma: string) {
  return { szo: d.statusLabel, utana: mikor(d.statusAt, ma), kesz: d.status === 'feldolgozva' || d.status === 'beadva' };
}

/** Lemondott / lejárt előfizetés: a főoldalon is látszik, meddig dolgozik a könyvelő, és egy gombbal folytatható. */
function SzolgaltatasVege({ n, fn }: { n: NonNullable<ClientHome['serviceNotice']>; fn: string }) {
  const meg = n.kind === 'megszunik' && n.endsOn;
  const folytat = useElofizetesFolytat();
  const jelez = useJelzes();
  return (
    <View style={{ borderRadius: 14, backgroundColor: szin.borostyanAlap, padding: 14, marginBottom: 12 }}>
      <T m={15.5} s={650} c={szin.borostyanSzoveg} lh={1.45}>
        {meg ? `Lemondtad az előfizetést: ${datumIg(n.endsOn!)} ${fn} intézi a könyvelésed, utána leáll.` : `Az előfizetésed lejárt, ${fn} már nem dolgozik a könyveléseden.`}
      </T>
      <GombSz
        cim={n.canResume ? (folytat.isPending ? 'Egy pillanat…' : 'Mégis maradok') : 'Előfizetés folytatása'}
        c={szin.borostyanSzoveg}
        onPress={async () => {
          if (!n.canResume) return router.push('/fiok/elofizetes');
          try {
            await folytat.mutateAsync();
            jelez({ szoveg: 'Örülünk! Az előfizetésed marad.', kesz: true });
          } catch (e) {
            jelez(hibaUzenet(e, 'Nem sikerült. Próbáld újra az Előfizetés oldalon.'));
          }
        }}
        style={{ paddingBottom: 0 }}
      />
    </View>
  );
}

export default function Fooldal() {
  const param = useLocalSearchParams<{ lap?: string; lepes?: string }>();
  const home = useHome();
  const h = home.data;
  const idoszak = useIdoszak(h?.hero.periodId);
  const [lap, setLap] = useState<LapNev>((['hogyan', 'szamlaszamok', 'befizettem'] as const).find((x) => x === param.lap) ?? null);

  useEffect(() => {
    if (h) {
      maBeallit(h.today);
      demoBeallit(h.demo);
    }
  }, [h]);

  if (home.isLoading) return <Kepernyo ful="fooldal"><Betolt /></Kepernyo>;
  if (home.error || !h) return <Kepernyo ful="fooldal"><Hiba hiba={home.error} ujra={() => void home.refetch()} /></Kepernyo>;
  if (h.hero.state === 'bekotes_alatt' || !h.client.onboardingComplete) return <Redirect href="/bekotes" />;

  const fn = h.accountant.firstName;
  const limits = h.limits;
  const dosszieHonap = h.currentDossier.month;
  const honapNevu = honapMelleknev(dosszieHonap);

  return (
    <Kepernyo ful="fooldal" fejlec={<Sav h={h} lap={setLap} />} tartalomStilus={{ paddingTop: 12 }}>
      <AktivalasKartya ugyfel={h.client.id} fn={fn} />
      {h.serviceNotice ? <SzolgaltatasVege n={h.serviceNotice} fn={fn} /> : null}
      {h.letter ? <Level level={h.letter} alairasUt={h.accountant.signatureSvgPath} befizetve={h.hero.state === 'befizetve' && lap !== 'befizettem'} /> : null}
      <FizetesLap h={h} lap={setLap} />
      <Gyorsgombok />
      {/* SPEC §26.2.1: the callback entry of the Főoldal (source konyvelo_kartya). It sits BELOW the quick actions in
          every state: between the letter and the payment sheet it pushed the quick actions under the tab bar
          (approved 03 / TERV §5: the first screen ends with the quick-action sheet). */}
      <Elakadtal forras="konyvelo_kartya" tema="egyeb" cim="Kérdésed van? Kérj visszahívást" style={{ marginLeft: 4 }} />

      {h.requestsFromAccountant.length ? (
        <>
          <Szakasz cim={`${fn} kéri`} />
          {h.requestsFromAccountant.map((r, i) => (
            <Lap key={r.id} style={{ padding: 18, marginTop: i ? 12 : 0 }}>
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                <T m={17} s={650} lh={1.4} ls={-0.01} style={{ flex: 1 }}>
                  {r.title}
                </T>
                {r.dueDate && r.dueDate < h.today ? <Cimke szoveg="lejárt" veszely style={{ marginTop: 2 }} /> : null}
              </View>
              <T m={15} lh={1.5} c={szin.halvany} style={{ marginTop: 4, marginBottom: 14 }}>
                {r.body}
                {r.dueDate ? (r.dueDate < h.today ? ` A határidő ${datumE(r.dueDate)} volt, küldd el mielőbb.` : ` Határidő: ${datumIg(r.dueDate)}.`) : ''}
              </T>
              <GombM
                cim={/kivonat/i.test(r.title) ? 'Kivonat feltöltése' : r.type === 'dokumentum' ? 'Feltöltöm' : 'Válaszolok'}
                ikon={r.type === 'dokumentum' ? 'feltoltes' : 'kerdezek'}
                onPress={() =>
                  r.type === 'dokumentum'
                    ? router.push({ pathname: '/feltoltes', params: { keres: r.id, kategoria: /kivonat/i.test(r.title) ? 'bankszamlakivonat' : 'egyeb', honap: r.dossierMonth ?? '' } })
                    : router.push('/uzenetek')
                }
              />
              <KeresKeszGomb id={r.id} fn={fn} />
            </Lap>
          ))}
        </>
      ) : null}

      <Szakasz cim="Idei kereteid" />
      <Lap>
        <Mero
          meter={limits.afa}
          mellek="Ennyi fér még az alanyi ÁFA-mentességbe. A csíkozott rész az, amennyit ilyen tempóban év végéig várhatóan számlázol."
          balVeg={`eddig ${szam(limits.afa.usedHuf)} Ft`}
          jobbVeg={`a keret ${szam(limits.afa.limitHuf)} Ft`}
        />
        <View style={{ height: 1, backgroundColor: szin.hajszal }} />
        {limits.adomentes.reached ? (
          <PipaMondat
            cim={`Az adómentes részt ${limits.adomentes.reachedMonth ? ['januárban', 'februárban', 'márciusban', 'áprilisban', 'májusban', 'júniusban', 'júliusban', 'augusztusban', 'szeptemberben', 'októberben', 'novemberben', 'decemberben'][limits.adomentes.reachedMonth - 1] : 'idén'} elérted.`}
            mellek={/^Az adómentes részt/.test(limits.adomentes.sentence) ? `Az első ${szam(limits.adomentes.limitHuf)} Ft jövedelmed adómentes volt. Azóta fizetsz SZJA-előleget, ez így rendben van.` : limits.adomentes.sentence}
          />
        ) : (
          <View style={{ paddingTop: 17, paddingHorizontal: 18, paddingBottom: 16 }}>
            <T m={17} s={650} lh={1.4}>
              Még az adómentes részben jársz.
            </T>
            <T m={15} lh={1.5} c={szin.halvany} style={{ marginTop: 3 }}>
              {limits.adomentes.sentence}
            </T>
          </View>
        )}
        {limits.atalanyCap.ratio >= 0.5 ? (
          <>
            <View style={{ height: 1, backgroundColor: szin.hajszal }} />
            <Mero
              meter={limits.atalanyCap}
              mellek="Az átalányadózásnak felső bevételi határa van. Ha közelíted, a könyvelőd előre szól."
              balVeg={`eddig ${szam(limits.atalanyCap.usedHuf)} Ft`}
              jobbVeg={`a határ ${szam(limits.atalanyCap.limitHuf)} Ft`}
            />
          </>
        ) : null}
      </Lap>

      <Szakasz cim="Idei bevételed" />
      <Lap>
        <BevetelOszlopok honapok={h.revenueByMonth} ma={h.today} />
      </Lap>

      <Szakasz cim={nagybetu(h.currentDossier.label)} />
      <Lap>
        {h.currentDossier.items.map((d, i) => {
          const a = iratAllapot(d, h.today);
          return <Sor key={d.id} elso={i === 0} ikon={d.icon} kesz={a.kesz} cim={d.title} al={<Allapot szo={a.szo} utana={a.utana} />} onPress={() => router.push(`/tetel/${d.id}`)} />;
        })}
        <Sor elso={!h.currentDossier.items.length} ikon="dosszie" cim={`Az egész ${honapNevu} dosszié`} cimSzin={szin.tintakekSzoveg} cimSuly={600} minH={54} onPress={() => router.push({ pathname: '/dosszie', params: { honap: dosszieHonap } })} />
      </Lap>

      <HogyanJottKi lathato={lap === 'hogyan'} bezar={() => setLap(null)} idoszak={idoszak.data} konyvelo={h.accountant} />
      <Szamlaszamok lathato={lap === 'szamlaszamok'} bezar={() => setLap(null)} tetelek={h.paymentItems} befizettem={() => setLap('befizettem')} />
      <Befizettem
        lathato={lap === 'befizettem'}
        bezar={() => setLap(null)}
        idoszak={h.hero.periodId && h.hero.periodKey && h.hero.dueDate ? { id: h.hero.periodId, periodKey: h.hero.periodKey, dueDate: h.hero.dueDate } : undefined}
        tetelek={h.paymentItems}
        konyvelo={h.accountant}
        kesz={param.lepes === '2'}
      />
    </Kepernyo>
  );
}
