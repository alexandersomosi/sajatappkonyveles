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
import { Arckep, Ikon3d, KeszJel, type Ikon3dNev } from '@/ui/kepek';
import { EvesKartya, FelreteszKartya, HaviKartya, KedvezmenyTipp, KeresetKartya, KetSzam, SzunetelKartya } from '@/kepernyok/k28';
import { HOME_K_TEXTS } from '@/_shared/bekotes';
import { Betolt, demoBeallit, Hiba, Kepernyo, useJelzes } from '@/ui/keret';
import { Level } from '@/ui/Level';
import { Elakadtal } from '@/ui/Visszahivas';
import { BevetelOszlopok, Mero, PipaMondat } from '@/ui/Mero';
import { T } from '@/ui/T';
import { hibaUzenet } from '@/lib/hiba';
import { fillPlaceholders, JOURNEY_TEXTS, LOCK_TEXTS, PAUSE_TEXTS } from '@/_shared/bekotes';
import { useServiceLock } from '@/ui/Zarolas';
import { beallitasIr, beallitasOlvas } from '@/lib/tarolo';
import { useGuided } from '@/api/hooks-k29g';
import { useElofizetesK29 } from '@/api/hooks-k29';
import { PAYMENT_SCREEN_TEXTS as P29 } from '@/_shared/k29';

/** S25 – egyszeri kártya az első aktív Főoldalon: „Kész a bekötés!” (SPEC §27.4.4). Csak ezen a telefonon jegyzi meg. */
function AktivalasKartya({ ugyfel, fn }: { ugyfel: string; fn: string }) {
  const kulcs = `kj_aktiv_kartya_${ugyfel}`;
  const [lathato, setLathato] = useState(false);
  useEffect(() => {
    void beallitasOlvas(kulcs).then((v) => setLathato(!v)).catch(() => undefined);
  }, [kulcs]);
  if (!lathato) return null;
  return (
    <Lap style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 14 }}>
      <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center', minHeight: 32 }}>
        <KeszJel pt={28} />
        <T m={18} s={650} lh={1.3} style={{ flex: 1 }} accessibilityRole="header">
          {JOURNEY_TEXTS.activeTitle}
        </T>
      </View>
      <View style={{ paddingLeft: 38 }}>
        <T m={16} lh={1.45} style={{ marginTop: 4 }}>
          {fillPlaceholders(JOURNEY_TEXTS.activeBody, { firstName: fn })}
        </T>
        <GombM
          cim="Rendben"
          style={{ marginTop: 10 }}
          onPress={() => {
            setLathato(false);
            void beallitasIr(kulcs, '1');
          }}
        />
      </View>
    </Lap>
  );
}

type LapNev = null | 'hogyan' | 'szamlaszamok' | 'befizettem';

/** SPEC §29.9.4: the client text of a manual lock (SERVICE_LOCK_REASONS 'kezi'). */
const KEZI_ZAROLAS = 'Szünetel a könyvelésed. Írj nekünk, ha kérdésed van.';

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
  const fn = h.accountant.firstName;
  const { lock } = useServiceLock();
  const osszeg = szam(hero.amountHuf ?? 0);
  // k6c2: an estimate carries "kb." → rounded to 1 000; "Eddig" only when the amount really is what gathered so far
  // (the running quarter of a főfoglalkozású already holds the fixed járulék of its months still to come)
  const kerek = szam(Math.round((hero.amountHuf ?? 0) / 1000) * 1000);
  const fo: { ikon: Ikon3dNev; cim: string; mondat: string | null } =
    hero.state === 'befizetve'
      ? { ikon: 'befizetve', cim: 'Befizetted', mondat: `${osszeg} Ft, ${hero.paidOn ? datumAn(hero.paidOn) : ''}. ${hero.verified ? `${fn} látta a kivonatodon: megérkezett.` : `${fn} a kivonatodon ellenőrzi.`}` }
      : hero.state === 'nincs_fizetendo'
        ? {
            ikon: 'hataridok',
            cim: lock ? LOCK_TEXTS.heroTitle : 'Most nincs mit fizetned',
            // k6c2: under the lock banner never "Bence szól…" – the bookkeeping is paused until the fee is paid
            // §29.9.4: a manual lock by the admin ('kezi') is not about an unpaid fee
            mondat: lock
              ? lock.reasons.every((r) => r === 'kezi')
                ? KEZI_ZAROLAS
                : fillPlaceholders(LOCK_TEXTS.heroNote, { mit: lock.reasons.filter((r) => r !== 'kezi').map((r) => (LOCK_TEXTS.mit as Record<string, string>)[r] ?? r).join(' és ') })
              : (hero.note ?? `${fn} szól, amikor legközelebb fizetni kell.`),
          }
        : hero.state === 'jovahagyva'
          ? { ikon: 'szamlaszam', cim: fillPlaceholders(HOME_K_TEXTS.payTitle, { osszeg, hatarido: '' }).trim(), mondat: hero.dueDate ? `${hataridoSav(hero.dueDate)}. ${fn} jóváhagyta${hero.periodLabel ? `: ${hero.periodLabel}` : ''}.` : null }
          : { ikon: 'szamolo', cim: hero.futureFixedMonths?.length ? `Kb. ${kerek} Ft` : `Eddig kb. ${kerek} Ft`, mondat: `${hero.periodLabel ? `${nagybetu(hero.periodLabel)}, becslés. ` : 'Becslés. '}${hero.dueDate ? `Befizetés ${datumIg(hero.dueDate)}. ` : ''}${hero.note ?? `${fn} a negyedév végén véglegesíti.`}` };
  return (
    <Fejlec rozX={318} rozY={128} alsoTer={20}>
      {/* ki a könyvelőd */}
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36, paddingHorizontal: 16, paddingRight: 70 }}>
        <View style={{ borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)' }}>
          <Arckep pt={30} />
        </View>
        <T m={15} lh={1.3} c={szin.fejlecHalvany} style={{ flex: 1 }} numberOfLines={1}>
          <T m={15} s={650} c="#fff">
            {h.accountant.displayName}
          </T>
          , a könyvelőd
        </T>
      </View>
      {/* mi a dolgod most */}
      <Animated.View style={{ opacity: attunes, paddingHorizontal: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
          <Ikon3d nev={fo.ikon} pt={30} />
          <T m={keskeny ? 23 : 26} maxFontSizeMultiplier={1.4} s={700} lh={1.15} ls={-0.022} c="#fff" szam style={{ flexShrink: 1 }} accessibilityRole="header">
            {fo.cim}
          </T>
          {hero.state === 'jovahagyva' && hero.daysLeft != null && hero.daysLeft <= 14 ? <Cimke szoveg={hatraVan(hero.daysLeft)} /> : null}
        </View>
        {fo.mondat ? (
          <T m={16} lh={1.45} c={szin.fejlecHalvany} style={{ marginTop: 4, paddingLeft: 38 }}>
            {fo.mondat}
          </T>
        ) : null}
      </Animated.View>
      {hero.periodId ? <GombSav cim="Hogyan jött ki?" ikon="szamolo" onPress={() => lap('hogyan')} style={{ marginTop: 12, marginLeft: 54 }} /> : null}
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
    <Lap style={{ paddingTop: 16, paddingBottom: 12 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 32, paddingHorizontal: 16, paddingBottom: 4 }}>
        <Ikon3d nev="szamlaszam" pt={28} />
        <T m={18} s={650} lh={1.3} ls={-0.012} style={{ flex: 1 }} accessibilityRole="header">
          {fej}
        </T>
      </View>
      {t.map((x0, i) => {
        // Jóváhagyott 03: „SZJA-előleg III. negyedév” egy sorban. Ha a szerver hosszú, magyarázó alcímet ad
        // („személyi jövedelemadó-előleg”), itt a negyedév neve áll – a teljes név a „Hogyan jött ki?” lapon olvasható –,
        // különben a harmadik sor is kétsoros lenne, és a gyorsműveletek a fülsor alá csúsznának.
        const x = x0.kind === 'szja_eloleg' && h.hero.periodLabel && (!x0.sublabel || x0.sublabel.length > 16) ? { ...x0, sublabel: h.hero.periodLabel } : x0;
        return (
        <View key={x.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, minHeight: 52, paddingVertical: 6, paddingLeft: 54, paddingRight: 16 }}>
          {i > 0 ? <View style={{ position: 'absolute', top: 0, left: 54, right: 16, height: 1, backgroundColor: szin.hajszal }} /> : null}
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
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingTop: 8, paddingLeft: 54, paddingRight: 16 }}>
          {/* SPEC §28.K.12 #2: számlaszám, közlemény másolással; a fő gomb lent a dokkban: „Elutaltam” */}
          <GombM cim="Számlaszámok és közlemény" onPress={() => lap('szamlaszamok')} />
        </View>
      ) : null}
      {fizetve ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', justifyContent: 'space-between', columnGap: 10, paddingTop: 8, paddingLeft: 54, paddingRight: 16 }}>
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
        <T m={15} c={szin.halvany} lh={1.45} style={{ paddingTop: 8, paddingLeft: 54, paddingRight: 16 }}>
          Még ne utald el: {h.accountant.firstName} a negyedév végén véglegesíti, és szól, mennyit kell fizetned.
        </T>
      ) : null}
    </Lap>
  );
}

const GYORS: { cim: string; ikon: Ikon3dNev; ut: string }[] = [
  { cim: 'Feltöltés', ikon: 'feltoltes', ut: '/feltoltes' },
  { cim: 'Kérdezek', ikon: 'kerdezek', ut: '/uzenetek' },
  // SPEC §29.5 / §29.6: „Igazolást kérek” és a bevételi kimutatás egy koppintásra
  { cim: 'Igazolás', ikon: 'igazolas', ut: '/igazolas' },
  { cim: 'Kimutatás', ikon: 'kivonat', ut: '/kimutatas' },
  { cim: 'Határidők', ikon: 'hataridok', ut: '/hataridok' },
];
function Gyorsgombok() {
  // SPEC §29.5/§29.6: 5 quick actions – on a 320 pt screen the labels get smaller so "Kimutatás" and "Határidők" do not touch
  const { width } = useWindowDimensions();
  const szuk = width < 360;
  return (
    <Lap style={{ flexDirection: 'row', paddingVertical: 10, paddingHorizontal: 4 }}>
      <View accessibilityRole="menu" style={{ flex: 1, flexDirection: 'row' }}>
        {GYORS.map((g) => (
          <Pressable key={g.cim} accessibilityRole="button" accessibilityLabel={g.cim} onPress={() => router.push(g.ut as never)} style={({ pressed }) => [{ flex: 1, alignItems: 'center', gap: 4, minHeight: 56, justifyContent: 'center' }, pressed && { opacity: 0.7 }]}>
            <Ikon3d nev={g.ikon} pt={szuk ? 28 : 32} arnyektalan={false} />
            <T m={szuk ? 11.5 : 13.5} s={550} lh={1.2} kozep ls={szuk ? -0.02 : -0.005} numberOfLines={1}>
              {g.cim}
            </T>
          </Pressable>
        ))}
      </View>
    </Lap>
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

/**
 * SPEC §29.10.1: a client in onboarding lands in the guided first run (`/bevezeto`) until he pauses it ("Később
 * folytatom") or saw its done screen; otherwise on the checklist (`/bekotes`). A server without §29 → the checklist.
 */
function BekotesKapu() {
  const g = useGuided();
  if (g.isLoading) return <Kepernyo ful="fooldal"><Betolt /></Kepernyo>;
  return <Redirect href={g.data?.show ? '/bevezeto' : '/bekotes'} />;
}

export default function Fooldal() {
  const param = useLocalSearchParams<{ lap?: string; lepes?: string }>();
  const home = useHome();
  const h = home.data;
  // SPEC §29.1.5: an unpaid month (bank check, decline, expired card) → red line + "Fizesd ki" on the Főoldal
  const elo = useElofizetesK29(!!h && h.client.onboardingComplete);
  const due = elo.data?.due ?? null;
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
  if (h.hero.state === 'bekotes_alatt' || !h.client.onboardingComplete) return <BekotesKapu />;

  const fn = h.accountant.firstName;
  const limits = h.limits;
  const dosszieHonap = h.currentDossier.month;
  const honapNevu = honapMelleknev(dosszieHonap);

  const fizetendo = h.hero.state === 'jovahagyva' && h.paymentItems.some((x) => !x.markedPaidAt);
  return (
    <Kepernyo
      ful="fooldal"
      fejlec={<Sav h={h} lap={setLap} />}
      dokk={fizetendo ? <GombE cim={HOME_K_TEXTS.paidButton} onPress={() => setLap('befizettem')} /> : due ? <GombE cim={P29.fizesdKi.homeButton} onPress={() => router.push('/fizesd-ki')} /> : undefined}
    >
      {due ? (
        <Lap style={{ paddingHorizontal: 16, paddingVertical: 14, backgroundColor: szin.veszelyAlap }}>
          <Pressable accessibilityRole="link" onPress={() => router.push('/fizesd-ki')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ikon3d nev="szamlaszam" pt={28} />
            <T m={16.5} s={700} lh={1.35} c={szin.veszelySzoveg} style={{ flex: 1 }}>
              {fillPlaceholders(P29.fizesdKi.homeBanner, { osszeg: szam(due.amountHuf) })}
            </T>
            {fizetendo ? <GombM cim={P29.fizesdKi.homeButton} onPress={() => router.push('/fizesd-ki')} /> : null}
          </Pressable>
        </Lap>
      ) : null}
      {h.twoNumbers ? <KetSzam v={h.twoNumbers} /> : null}
      <AktivalasKartya ugyfel={h.client.id} fn={fn} />
      {h.serviceNotice ? <SzolgaltatasVege n={h.serviceNotice} fn={fn} /> : null}
      {h.pause ? <SzunetelKartya p={h.pause} /> : null}
      {h.checkin ? <HaviKartya c={h.checkin} /> : null}
      {h.annual && h.annual.status !== 'nem_indult' && h.annual.status !== 'kesz' ? <EvesKartya a={h.annual} fn={fn} /> : null}
      {/* k6c2 (tulaj 11-19 20:20 „csak valami elválasztó köztük”): a levél saját szakasz, fölötte a 10 pt-os sáv */}
      {h.letter ? <Level level={h.letter} alairasUt={h.accountant.signatureSvgPath} befizetve={h.hero.state === 'befizetve' && lap !== 'befizettem'} /> : null}
      <FizetesLap h={h} lap={setLap} />
      <Gyorsgombok />

      {h.requestsFromAccountant.length ? (
        <>
          <Szakasz ikon="irat" cim={`${fn} kéri`} />
          {h.requestsFromAccountant.map((r) => (
            <Lap key={r.id} style={{ paddingHorizontal: 16, paddingBottom: 14 }}>
              <View style={{ paddingLeft: 38 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8 }}>
                  <T m={16} s={600} lh={1.35} style={{ flex: 1 }}>
                    {r.title}
                  </T>
                  {r.dueDate && r.dueDate < h.today ? <Cimke szoveg="lejárt" veszely style={{ marginTop: 1 }} /> : null}
                </View>
                <T m={15} lh={1.45} c={szin.halvany} style={{ marginTop: 2, marginBottom: 10 }}>
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
              </View>
            </Lap>
          ))}
        </>
      ) : null}

      {h.reserve ? <FelreteszKartya c={h.reserve} fn={fn} /> : null}

      <Szakasz ikon="hataridok" cim="Idei kereteid" />
      <Lap>
        {h.pause ? (
          // k6c2: szüneteltetés alatt nem számlázhat – nincs „Még … Ft-ot számlázhatsz ÁFA nélkül”
          <T m={16} lh={1.45} style={{ paddingTop: 14, paddingHorizontal: 16, paddingBottom: 14 }}>
            {PAUSE_TEXTS.limitsPaused}
          </T>
        ) : (
        <Mero
          meter={limits.afa}
          mellek="Ennyi fér még az alanyi ÁFA-mentességbe. A csíkozott rész az, amennyit ilyen tempóban év végéig várhatóan számlázol."
          balVeg={`eddig ${szam(limits.afa.usedHuf)} Ft`}
          jobbVeg={`a keret ${szam(limits.afa.limitHuf)} Ft`}
        />
        )}
        {limits.kata ? null : <View style={{ height: 1, backgroundColor: szin.hajszal, marginHorizontal: 16 }} />}
        {limits.kata ? null : limits.adomentes.reached ? (
          <PipaMondat
            cim={`Az adómentes részt ${limits.adomentes.reachedMonth ? ['januárban', 'februárban', 'márciusban', 'áprilisban', 'májusban', 'júniusban', 'júliusban', 'augusztusban', 'szeptemberben', 'októberben', 'novemberben', 'decemberben'][limits.adomentes.reachedMonth - 1] : 'idén'} elérted.`}
            mellek={limits.adomentes.afterText ?? (/^Az adómentes részt/.test(limits.adomentes.sentence) ? `Az első ${szam(limits.adomentes.limitHuf)} Ft jövedelmed adómentes volt. Azóta fizetsz SZJA-előleget, ez így rendben van.` : limits.adomentes.sentence)}
          />
        ) : (
          <View style={{ paddingTop: 14, paddingHorizontal: 16, paddingBottom: 14 }}>
            <T m={16} s={600} lh={1.4}>
              Még az adómentes részben jársz.
            </T>
            <T m={15} lh={1.45} c={szin.halvany} style={{ marginTop: 2 }}>
              {limits.adomentes.sentence}
            </T>
          </View>
        )}
        {!limits.kata && !h.pause && limits.atalanyCap.ratio >= 0.5 ? (
          <>
            <View style={{ height: 1, backgroundColor: szin.hajszal, marginHorizontal: 16 }} />
            <Mero
              meter={limits.atalanyCap}
              mellek="Az átalányadózásnak felső bevételi határa van. Ha közelíted, a könyvelőd előre szól."
              balVeg={`eddig ${szam(limits.atalanyCap.usedHuf)} Ft`}
              jobbVeg={`a határ ${szam(limits.atalanyCap.limitHuf)} Ft`}
            />
          </>
        ) : null}
      </Lap>
      {h.allowancesHint?.show ? <KedvezmenyTipp ev={Number(h.today.slice(0, 4))} /> : null}

      <Szakasz ikon="kivonat" cim="Idei bevételed" />
      <Lap>
        <BevetelOszlopok honapok={h.revenueByMonth} ma={h.today} />
      </Lap>
      {h.earnings ? <KeresetKartya e={h.earnings} /> : null}

      <Szakasz ikon="dosszie" cim={nagybetu(h.currentDossier.label)} />
      <Lap>
        {h.currentDossier.items.map((d, i) => {
          const a = iratAllapot(d, h.today);
          return <Sor key={d.id} elso={i === 0} ikon={d.icon} kesz={a.kesz} cim={d.title} al={<Allapot szo={a.szo} utana={a.utana} />} onPress={() => router.push(`/tetel/${d.id}`)} />;
        })}
        <Sor elso={!h.currentDossier.items.length} ikon="dosszie" cim={`Az egész ${honapNevu} dosszié`} cimSzin={szin.tintakekSzoveg} cimSuly={600} onPress={() => router.push({ pathname: '/dosszie', params: { honap: dosszieHonap } })} />
      </Lap>

      {/* C: „Ha elakadsz” – egy mondat és egy kapszula (a visszahívás forrása: konyvelo_kartya, SPEC §26.2.1) */}
      <Szakasz ikon="kerdezek" cim="Ha elakadsz" jobbra={<GombM cim="Visszahívás" onPress={() => router.push({ pathname: '/visszahivas', params: { forras: 'konyvelo_kartya', tema: 'egyeb' } })} />} />
      <Lap style={{ paddingHorizontal: 16, paddingBottom: 16 }}>
        <T m={16} lh={1.45} style={{ paddingLeft: 38 }}>
          Kollégánk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között.
        </T>
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
