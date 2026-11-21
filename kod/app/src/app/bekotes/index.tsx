// 02 Bekötés = a Főoldal a bekötés alatt (SPEC §27.4.4 S2 + S4). EGY lista („Így halad a bekötésed”), EGY szám (a sáv, a
// fül-jelvény és a zárt lap ugyanazt mondja: journey.todoCount), EGY „Most ez jön” kártya (vagy a várakozó kártya: ki
// dolgozik, mennyi ideig, meddig). Az 1. sor (Vállalkozásod) mindig látszik, „Módosítom”-mal (S5). Amíg a fő kérdés
// megválaszolatlan, csak a kérdés + a szürke előnézet látszik („Utána ezek jönnek”), „Kitöltöm” kártya nincs.
// Régi (§26) változat: kod/app/_regi/elotte_tulaj1119/src/app/bekotes/index.tsx.
import { useEffect, useRef, useState } from 'react';
import { Pressable, useWindowDimensions, View, type ScrollViewInstance } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { JourneyView, OnboardingState } from '@/_shared/api';
import { ASSIST_TEXTS, fillPlaceholders, JOURNEY_TEXTS } from '@/_shared/bekotes';
import type { BusinessStatus } from '@/_shared/enums';
import { useMe } from '@/api/hooks';
import { helyettunkUt, nyitott, segitsegFajta, temaSorbol } from '@/lib/ut';
import { forma, szin } from '@/theme/tokens';
import { Fejlec, GombM, GombSav, Lap } from '@/ui/alap';
import { Arckep, Ikon3d, type Ikon3dNev } from '@/ui/kepek';
import { Betolt, Hiba, Kepernyo } from '@/ui/keret';
import { MiEz } from '@/ui/Magyarazat';
import { T } from '@/ui/T';
import { useEvSegitseg, KiemeltSor, MostEzJonKartya, SegitsegAllapot, UtLista, useUt, useUtvaltas, VarakozasCsik, VarakozasKartya } from '@/ui/Ut';
import { useLatta, VideoKartya } from '@/ui/Video';
import { JovahagytamGomb } from '@/ui/Helyettunk';
import { VisszahivasAllapot, VisszahivasKartya, visszahivasUt } from '@/ui/Visszahivas';
import { useGuided } from '@/api/hooks-k29g';
import { useElofizetesK29 } from '@/api/hooks-k29';
import { PAYMENT_SCREEN_TEXTS as P29 } from '@/_shared/k29';
import { HAVIDIJ_OK } from '@/lib/fizetes';
import { szam } from '@/lib/format';
import { FolytasKartya } from '@/kepernyok/Bevezeto';

/** S2 – „Van már egyéni vállalkozásod?” két válasszal (a „Még nincs” után a „Hogyan jelentsük be?” lap jön, S3). */
function ElagazasKartya({ rovid = false }: { rovid?: boolean }) {
  const ut = useUtvaltas();
  const [mit, setMit] = useState<BusinessStatus | null>(null);
  const kuld = async (b: BusinessStatus) => {
    setMit(b);
    try {
      await ut.valaszol(b);
    } catch {
      /* a hibát a lap / a jelzés mutatja */
    } finally {
      setMit(null);
    }
  };
  const Valasz = ({ b, cim, al, ikon }: { b: BusinessStatus; cim: string; al: string; ikon: Ikon3dNev }) => (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${cim}. ${al}`}
      disabled={mit !== null}
      onPress={() => void kuld(b)}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 14, minHeight: rovid ? 62 : 72, paddingVertical: rovid ? 8 : 10, paddingHorizontal: 14, borderRadius: forma.mezo, borderWidth: 1.5, borderColor: pressed ? szin.tintakek : szin.keret, backgroundColor: pressed ? '#F6F8FB' : szin.mezoAlap, opacity: mit !== null && mit !== b ? 0.5 : 1 })}
    >
      <Ikon3d nev={ikon} pt={rovid ? 38 : 44} />
      <View style={{ flex: 1 }}>
        <T m={rovid ? 17 : 18} s={700} lh={1.3}>
          {cim}
        </T>
        <T m={15} lh={1.4} c={szin.halvany}>
          {mit === b ? 'Mentjük…' : al}
        </T>
      </View>
    </Pressable>
  );
  return (
    <Lap style={{ marginTop: rovid ? 0 : 12, padding: rovid ? 14 : 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 10 }}>
        <T m={rovid ? 19 : 21} s={700} lh={1.28} ls={-0.02} style={{ flex: 1 }} accessibilityRole="header">
          Van már egyéni vállalkozásod?
        </T>
        <MiEz kulcs="vallalkozas_van_e" />
      </View>
      <T m={rovid ? 14.5 : 15.5} lh={1.45} c={szin.halvany} style={{ marginTop: 4, marginBottom: rovid ? 10 : 14 }}>
        Ha rosszat választasz, később módosíthatod.
      </T>
      <View style={{ gap: 10 }}>
        <Valasz b="van" cim="Igen, van" al="Már van adószámom." ikon="irat" />
        <Valasz b="inditas" cim="Még nincs, most indítanám" al="Segítünk elindítani." ikon="tepnaptar" />
      </View>
    </Lap>
  );
}

/** S2 – a szürke előnézet a megválaszolatlan kérdés alatt (nem gomb, nem „Most te jössz”). */
function Elonezet({ j }: { j: JourneyView }) {
  return (
    <>
      <View style={{ paddingTop: 26, paddingBottom: 8, paddingHorizontal: 4 }}>
        <T m={19.5} s={600} lh={1.25} ls={-0.016} accessibilityRole="header">
          {JOURNEY_TEXTS.previewTitle}
        </T>
        <T m={14.5} lh={1.4} c={szin.halvanyAlapon} style={{ marginTop: 5 }}>
          {JOURNEY_TEXTS.previewLocked}
        </T>
      </View>
      <Lap>
        {j.preview.map((cim, i) => (
          <View key={cim} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 50, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: szin.hajszal }}>
            <View style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, borderColor: szin.keret, alignItems: 'center', justifyContent: 'center' }}>
              <T m={13} s={700} c={szin.halvany} lh={1} szam>
                {i + 2}
              </T>
            </View>
            <T m={16} s={500} c={szin.halvany} style={{ flex: 1 }}>
              {cim}
            </T>
          </View>
        ))}
      </Lap>
      {/* 11-19 javító kör 2: a lista a „van” út – aki most indítja, annak hosszabb az útja; ezt előre mondjuk. */}
      <T m={14.5} lh={1.45} c={szin.halvanyAlapon} style={{ marginTop: 8, paddingHorizontal: 4 }}>
        {JOURNEY_TEXTS.previewInditas}
      </T>
    </>
  );
}

export default function Bekotes() {
  const { o, j, reg, keresek } = useUt();
  const me = useMe();
  const utv = useUtvaltas();
  const evNyitva = useEvSegitseg();
  const latta = useLatta('bekotes', me.data?.user.id);
  // SPEC §29.10.1: after "Később folytatom" the checklist opens with "Folytasd ott, ahol abbahagytad" on top
  const gv = useGuided();
  const folytas = gv.data && gv.data.inOnboarding && (gv.data.paused || gv.data.show) && gv.data.currentKey ? gv.data : null;
  // k7 integrator: onboarding can outlast the paid first month (NAV / meghatalmazás waits) – an unpaid month (bank check,
  // decline, expired card) needs the same red "Fizesd ki" line here as on the active Főoldal (SPEC §29.1.5)
  const elo = useElofizetesK29();
  // when the month is already locked, the lock band of every tab screen says it (with its own "Fizetek") – no second line
  const zarolvaHavidij = (me.data?.client?.serviceLock?.reasons ?? []).some((r) => (r as string) === 'havidij');
  const due = zarolvaHavidij ? null : (elo.data?.due ?? null);
  // „Mi kell még?” (zárolt funkció lap) → /bekotes?kovetkezo=1: a „Most ez jön” kártyához görgetünk (SPEC §26.5.3).
  const { kovetkezo } = useLocalSearchParams<{ kovetkezo?: string }>();
  const gorgeto = useRef<ScrollViewInstance>(null);
  const ablak = useWindowDimensions();
  const [fejMagas, setFejMagas] = useState<number | null>(null);
  const [kartyaY, setKartyaY] = useState<number | null>(null);
  useEffect(() => {
    if (kovetkezo !== '1' || fejMagas == null || kartyaY == null) return;
    const t = setTimeout(() => {
      gorgeto.current?.scrollTo({ y: Math.max(0, fejMagas + kartyaY - 12), animated: true });
      router.setParams({ kovetkezo: undefined });
    }, 120);
    return () => clearTimeout(t);
  }, [kovetkezo, fejMagas, kartyaY]);
  if (o.isLoading) return <Kepernyo ful="fooldal"><Betolt /></Kepernyo>;
  if (o.error || !o.data || !j) return <Kepernyo ful="fooldal"><Hiba hiba={o.error} ujra={() => void o.refetch()} /></Kepernyo>;
  const d: OnboardingState = o.data;
  const acc = d.accountant;
  const fn = acc.firstName;
  const most = j.steps.find((s) => s.key === j.currentKey) ?? null;
  const nincs = j.variant === 'nincs';
  const ev = segitsegFajta(d.assists, 'vallalkozas_bejelentes');
  const mh = segitsegFajta(d.assists, 'meghatalmazas');
  const nyitottSegitseg = [ev, mh].find((a) => nyitott(a)) ?? null;
  const regStatus = reg.data?.registration?.status ?? d.registration?.status ?? null;
  const bekuldve = !!regStatus && ['beadva', 'javitas', 'ellenorizve', 'kesz'].includes(regStatus);
  const keresekNyitott = (keresek.data?.items ?? []).filter((k) => k.direction === 'konyvelotol' && (k.status === 'nyitott' || k.status === 'folyamatban'));
  const cbNyitott = d.callback && (d.callback.status === 'uj' || d.callback.status === 'folyamatban') ? d.callback : null;
  const adatokKesz = d.steps.find((s) => s.step === 'adatok')?.status === 'kesz';
  const jovahagyando = most?.key === 'meghatalmazas' ? ([ev, mh].find((a) => a?.status === 'meghatalmazas_bekuldve') ?? null) : null;
  // A kiemelt „Intézzük helyetted” sor a „Most ez jön” kártyán (SPEC §27.3.1).
  const kiemelt =
    most && most.key === 'meghatalmazas' && !nyitott(mh) && !nyitott(ev) && !most.dueOn
      ? { cim: ASSIST_TEXTS.mhCardTitle, szoveg: fillPlaceholders(ASSIST_TEXTS.guideStripBodyMh, { firstName: fn }), ikon: 'igazolas' as const, ut: helyettunkUt('meghatalmazas', 'helyettunk_meghatalmazas') }
      : most && j.variant === 'inditas_onallo' && ['adatok', 'kerdoiv', 'bejelentes'].includes(most.key) && !bekuldve && !nyitott(ev) && evNyitva
        ? { cim: ASSIST_TEXTS.guideLink, szoveg: fillPlaceholders(ASSIST_TEXTS.guideStripBodyEv, { firstName: fn }), ikon: 'bevallas' as const, ut: helyettunkUt('vallalkozas_bejelentes', 'helyettunk_vallalkozas') }
        : null;
  // 11-19 javítás (320×640): amíg a fő kérdés nyitott, alacsony képernyőn a sáv rövid (a könyvelő-kártya nélkül), és a
  // videó a kérdés UTÁN jön – így mindkét válasz a fülsor fölött látszik.
  // 11-19 javító kör 2: alacsony képernyőn (< 720) a bekötés teljes ideje alatt a rövid sáv kell, hogy a „Most ez jön”
  // gombja a fülsor fölött legyen. A videó-sorrend csere csak a megválaszolatlan kérdésnél kell.
  const alacsony = ablak.height < 720;
  const rovid = nincs && alacsony;

  return (
    <Kepernyo
      ful="fooldal"
      szeles
      gorgetoRef={gorgeto}
      fejlec={
        <View onLayout={(e) => setFejMagas(e.nativeEvent.layout.height)}>
          <Fejlec alsoTer={22}>
            <View style={{ paddingHorizontal: asztali ? 16 : 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9, marginTop: asztali ? 0 : 8 }}>
                <View style={{ borderRadius: 18, borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)' }}>
                  <Arckep pt={32} />
                </View>
                <T m={15} lh={1.3} c={szin.fejlecHalvany} style={{ flex: 1 }} numberOfLines={1}>
                  <T m={15} s={650} c="#fff">
                    {acc.displayName}
                  </T>
                  , a könyvelőd
                </T>
              </View>
              <T m={asztali ? 33 : alacsony ? 24 : 27} s={800} lh={1.14} ls={-0.025} c="#fff" style={{ marginTop: alacsony ? 8 : 12 }} accessibilityRole="header">
                {j.bandTitle}
              </T>
              <GombSav cim="Kérj visszahívást" ikon="telefon" accessibilityLabel="Kérj visszahívást. A csapatunk 24–48 órán belül visszahív, munkanapokon 9 és 17 óra között." onPress={() => router.push(visszahivasUt('konyvelo_kartya', temaSorbol(j.currentKey)))} style={{ marginTop: 14 }} />
            </View>
          </Fejlec>
        </View>
      }
      tartalomStilus={{ paddingTop: 14 }}
    >
      {due ? (
        <Lap style={{ paddingHorizontal: 16, paddingVertical: 14, marginBottom: 12, borderLeftWidth: 4, borderLeftColor: szin.veszely }}>
          <Pressable accessibilityRole="link" onPress={() => router.push('/fizesd-ki')} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <Ikon3d nev="szamlaszam" pt={28} />
            <View style={{ flex: 1 }}>
              <T m={16.5} s={700} lh={1.35} c={szin.veszelySzoveg}>
                {`A havidíjad (${szam(due.amountHuf)} Ft) nincs kifizetve`}
              </T>
              <T m={15} lh={1.45} c={szin.veszelySzoveg} style={{ marginTop: 2 }}>
                {HAVIDIJ_OK[due.reason] ?? HAVIDIJ_OK.esedekes}
              </T>
            </View>
            <GombM cim={P29.fizesdKi.homeButton} onPress={() => router.push('/fizesd-ki')} />
          </Pressable>
        </Lap>
      ) : null}
      {folytas ? <FolytasKartya v={folytas} elso /> : null}
      {nincs ? (
        <>
          {/* Amíg a kérdés nyitott, a videó alacsony kártya – kis képernyőn egy sor –, hogy mindkét válasz a fülsor
              fölött látsszon (SPEC §26.7.3). */}
          {rovid ? null : <VideoKartya nev="bekotes" cim="Nézd meg, hogyan működik" magas={200} kompakt osszecsukva={latta.latta || ablak.height < 800 || Math.min(ablak.width, 480) < 375} latta={latta.jelol} />}
          <ElagazasKartya rovid={rovid} />
          {rovid ? (
            <View style={{ marginTop: 12 }}>
              <VideoKartya nev="bekotes" cim="Nézd meg, hogyan működik" magas={200} kompakt osszecsukva latta={latta.jelol} />
            </View>
          ) : null}
          <Elonezet j={j} />
          <VisszahivasKartya fn={fn} cb={d.callback ?? null} />
        </>
      ) : (
        <>
          {/* egysoros állapot: a nyitott „Intézzük helyetted” kérés, különben a nyitott visszahívás */}
          {nyitottSegitseg ? <SegitsegAllapot a={nyitottSegitseg} fn={fn} kompakt cb={d.callback ?? null} style={{ marginBottom: 2 }} /> : cbNyitott ? <VisszahivasAllapot cb={cbNyitott} kompakt /> : null}

          <View onLayout={(e) => setKartyaY(e.nativeEvent.layout.y)} />
          {/* k7c2: while the guided run is open, its "Folytasd ott" card is THE next step – no second "Most ez jön" */}
          {most && !folytas ? (
            <>
              {j.waiting ? <VarakozasCsik w={j.waiting} /> : null}
              <MostEzJonKartya s={most} fn={fn} utvalt={utv.modosit} lab={jovahagyando ? <JovahagytamGomb a={jovahagyando} fn={fn} /> : null} />
              {kiemelt ? <KiemeltSor cim={kiemelt.cim} szoveg={kiemelt.szoveg} ikon={kiemelt.ikon} onPress={() => router.push(kiemelt.ut)} /> : null}
            </>
          ) : j.waiting && !folytas ? (
            <VarakozasKartya w={j.waiting} />
          ) : null}

          {keresekNyitott.map((k) => (
            <Lap key={k.id} style={{ marginTop: 12, padding: 18 }}>
              <T m={14} s={650} c={szin.halvany}>
                {fn} kéri
              </T>
              <T m={18} s={700} lh={1.3} style={{ marginTop: 2 }}>
                {k.title}
              </T>
              {k.body ? (
                <T m={15.5} lh={1.5} c={szin.halvany} style={{ marginTop: 4 }}>
                  {k.body}
                </T>
              ) : null}
              <GombM
                cim={/kivonat/i.test(k.title) ? 'Feltöltöm a kivonatokat' : 'Feltöltöm'}
                style={{ marginTop: 12 }}
                onPress={() => router.push({ pathname: '/feltoltes', params: { keres: k.id, kategoria: /kivonat/i.test(k.title) ? 'bankszamlakivonat' : 'egyeb' } })}
              />
            </Lap>
          ))}

          <UtLista j={j} fn={fn} utvalt={utv.modosit} szamNelkul={!!folytas} />

          <View style={{ marginTop: 16 }}>
            <VideoKartya nev="bekotes" cim="Nézd meg, hogyan működik" magas={200} osszecsukva={latta.latta || adatokKesz} latta={latta.jelol} />
          </View>
          {cbNyitott ? null : <VisszahivasKartya fn={fn} cb={null} />}
        </>
      )}
    </Kepernyo>
  );
}
