// S15 – „Intézzük helyetted – így megy” (SPEC §27.3.2): a kérés = visszahívás típussal. Felül a számozott „így megy”
// lista (ki lép · mit · mennyi idő), mire lesz szükség, a „soha nem kérjük el a belépésedet” doboz, aztán a visszahívás
// mezői (§26.2.2: maszkolt szám + „Másik számot adok meg”, mikor, megjegyzés; a téma rögzített), az ígéret és a gomb.
// Ha már van ilyen kérése: az állapota, a lista, és „Mégis magam csinálom”. ?fajta=vallalkozas_bejelentes|meghatalmazas
// &forras=<hely>.
import { useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, View, type ScrollViewInstance } from 'react-native';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import type { AssistView, OnboardingState } from '@/_shared/api';
import { ASSIST_TEXTS, normalizeHuPhone } from '@/_shared/bekotes';
import {
  ASSIST_CALLBACK_TOPIC, CALLBACK_RULES, CALLBACK_SOURCES, CALLBACK_TOPIC_LABELS,
  type AssistKind, type CallbackSource, type CallbackWindow,
} from '@/_shared/enums';
import { ApiHiba, post, put } from '@/api/http';
import { useMe, useOnboarding, useSegitsegKer, useSegitsegLemond, useVisszahivasKer, useVisszahivasok } from '@/api/hooks';
import { useQueryClient } from '@tanstack/react-query';
import { hibaUzenet } from '@/lib/hiba';
import { bekotesre, vezetettHref } from '@/lib/vezetett';
import { useVezetettParam } from '@/ui/Vezetett';
import { segitsegFajta } from '@/lib/ut';
import { forma, szin } from '@/theme/tokens';
import { GombE, GombM, GombSz, HibaSzoveg, Lap, Pipa, Szakasz, Valaszto } from '@/ui/alap';
import { AlsoLap, Betolt, CimSor, Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { Mezo } from '@/ui/Mezo';
import { T } from '@/ui/T';
import { useEvSegitseg, SegitsegAllapot } from '@/ui/Ut';
import { IgyMegy, SohaBelepes } from '@/ui/Helyettunk';
import { alapIgeret, Elakadtal, Igeret, visszahivasUt } from '@/ui/Visszahivas';

const TELEFON_HIBA = 'Magyar telefonszámot adj meg, például +36 30 123 4567.';

export default function Helyettunk() {
  const p = useLocalSearchParams<{ fajta?: string; forras?: string }>();
  const fajta: AssistKind = p.fajta === 'meghatalmazas' ? 'meghatalmazas' : 'vallalkozas_bejelentes';
  const forras: CallbackSource = (CALLBACK_SOURCES as readonly string[]).includes(p.forras ?? '') ? (p.forras as CallbackSource) : fajta === 'meghatalmazas' ? 'helyettunk_meghatalmazas' : 'helyettunk_vallalkozas';
  const me = useMe();
  const evNyitva = useEvSegitseg();
  const o = useOnboarding();
  const cb = useVisszahivasok();
  const ker = useSegitsegKer();
  const regiCb = useVisszahivasKer();
  const lemond = useSegitsegLemond();
  const qc = useQueryClient();
  const jelez = useJelzes();
  const fn = o.data?.accountant.firstName ?? me.data?.accountant?.firstName ?? 'a könyvelőd';
  const fnK = /^A könyvelőd/.test(fn) ? `a${fn.slice(1)}` : fn;
  const igeret = cb.data?.promise ?? alapIgeret(fn);
  const [masikSzam, setMasikSzam] = useState(false);
  const [telefon, setTelefon] = useState('');
  const [mentsd, setMentsd] = useState(true);
  const [megj, setMegj] = useState('');
  const [sav, setSav] = useState<CallbackWindow>('barmikor');
  const [h, setH] = useState<{ telefon?: string | null; megj?: string | null }>({});
  const [hiba, setHiba] = useState<string | null>(null);
  const [kikapcsolva, setKikapcsolva] = useState(false);
  const [lemondLap, setLemondLap] = useState(false);
  const gorgeto = useRef<ScrollViewInstance>(null);
  const meglevo: AssistView | null = segitsegFajta(o.data?.assists, fajta);
  const cim = fajta === 'meghatalmazas' ? ASSIST_TEXTS.sheetTitleMh : ASSIST_TEXTS.sheetTitleEv;
  // k7c: opened from a guided step (`?vezetett=<lépés>`): the guided header and bar stay, "Vissza" returns to that step
  const vk = useVezetettParam();
  const lepesre = (ut: string) => (vk ? vezetettHref(ut, vk) : ut);
  const fej = <CimSor visszaCim="Vissza" vissza={() => (vk && router.canGoBack() ? router.back() : vissza('/bekotes'))} cim={cim} />;
  const evZarva = fajta === 'vallalkozas_bejelentes' && (kikapcsolva || !evNyitva);

  // k6c: an active client (his business runs) never sees the new-business flow here – his "intézzük helyetted" is a change
  if (fajta === 'vallalkozas_bejelentes' && me.data?.client?.lifecycle === 'aktiv') return <Redirect href="/valtozas" />;
  if (o.isLoading || cb.isLoading) return <Kepernyo ful="fooldal" fejlec={fej}><Betolt /></Kepernyo>;

  // Már kérte: az állapot, a lista, és „Mégis magam csinálom” (amíg a bejelentés el nem ment).
  if (meglevo) {
    return (
      <Kepernyo ful="fooldal" fejlec={fej}>
        <SegitsegAllapot a={meglevo} fn={fn} cb={cb.data?.open ?? o.data?.callback ?? null} />
        <Szakasz cim="Így megy" />
        <IgyMegy fajta={fajta} fn={fn} />
        <SohaBelepes fn={fn} style={{ marginTop: 12 }} />
        {meglevo.canCancel ? <GombSz cim={ASSIST_TEXTS.cancelLink} onPress={() => setLemondLap(true)} style={{ marginTop: 8, marginLeft: 4 }} /> : null}
        <Elakadtal forras={forras} tema={ASSIST_CALLBACK_TOPIC[fajta]} style={{ marginLeft: 4 }} />
        <AlsoLap lathato={lemondLap} bezar={() => setLemondLap(false)}>
          <T m={21} s={700} lh={1.3} style={{ paddingRight: 80 }} accessibilityRole="header">
            {ASSIST_TEXTS.cancelSheetTitle}
          </T>
          <T m={16} lh={1.5} c={szin.halvany} style={{ marginTop: 6, marginBottom: 16 }}>
            {ASSIST_TEXTS.cancelSheetBody}
          </T>
          <GombE
            cim={ASSIST_TEXTS.cancelButton}
            tolt={lemond.isPending}
            onPress={async () => {
              try {
                await lemond.mutateAsync({ id: meglevo.id });
                setLemondLap(false);
                jelez({ szoveg: 'Rendben, magad intézed. Lépésről lépésre segítünk.', kesz: true });
                router.replace(lepesre(fajta === 'meghatalmazas' ? '/bekotes/meghatalmazas' : '/bekotes/vallalkozas') as never);
              } catch (e) {
                jelez(hibaUzenet(e, 'Nem sikerült. Próbáld újra.'));
              }
            }}
          />
          <GombSz cim="Mégis kérem" onPress={() => setLemondLap(false)} style={{ alignSelf: 'center', marginTop: 6 }} />
        </AlsoLap>
      </Kepernyo>
    );
  }

  const vanProfilSzam = !!cb.data?.phoneOnFileMasked;
  const ujSzam = masikSzam || !vanProfilSzam;
  const telefonBlokk = (
    <>
      <Mezo
        felirat="Ezen a számon hívjunk"
        value={telefon}
        onChangeText={(t) => {
          setTelefon(t);
          if (h.telefon) setH((x) => ({ ...x, telefon: null }));
        }}
        keyboardType="phone-pad"
        autoComplete="tel"
        placeholder="+36 30 123 4567"
        hiba={h.telefon}
      />
      <Pipa be={mentsd} valt={setMentsd} style={{ marginTop: 6 }}>
        Mentsd el a profilomba is
      </Pipa>
      {vanProfilSzam ? <GombSz cim={`Mégis ezen: ${cb.data?.phoneOnFileMasked}`} onPress={() => setMasikSzam(false)} /> : null}
    </>
  );

  async function kuld() {
    const e: typeof h = {};
    let norm: string | null = null;
    if (ujSzam) {
      norm = normalizeHuPhone(telefon);
      e.telefon = norm ? null : TELEFON_HIBA;
    }
    e.megj = megj.length > CALLBACK_RULES.noteMaxChars ? `Legfeljebb ${CALLBACK_RULES.noteMaxChars} karakter lehet.` : null;
    setH(e);
    // a számmező a lap tetején van (ha az alsó gombbal küldte, odaugrunk, hogy lássa a hibát)
    if (e.telefon) gorgeto.current?.scrollTo({ y: 0, animated: true });
    if (e.telefon || e.megj) return;
    setHiba(null);
    try {
      // A bejelentést csak az indítás-úton kérheti: ha még nem ezen van, előbb átállítjuk (SPEC §27.3.2).
      if (fajta === 'vallalkozas_bejelentes' && o.data?.path !== 'inditas') {
        const uj = await put<OnboardingState>('/client/onboarding/business-status', { businessStatus: 'inditas' });
        if (uj && Array.isArray(uj.steps)) qc.setQueryData(['onboarding'], uj);
      }
      await ker.mutateAsync({ kind: fajta, source: forras, ...(norm ? { phone: norm, savePhoneToProfile: mentsd } : {}), window: sav, note: megj.trim() || undefined });
      jelez({ szoveg: ASSIST_TEXTS.toast, kesz: true });
      bekotesre();
    } catch (err) {
      if (err instanceof ApiHiba && err.code === 'assist_already_open') {
        void o.refetch();
        jelez('Már kérted. Itt látod, hol tart.');
        return;
      }
      if (err instanceof ApiHiba && err.code === 'assist_disabled') {
        setKikapcsolva(true);
        return;
      }
      // §27 nélküli szerver (régi backend): sima visszahívás a régi témával, a kérés a megjegyzésben.
      if (err instanceof ApiHiba && err.status === 404) {
        try {
          if (fajta === 'meghatalmazas') await post('/client/onboarding/meghatalmazas', { method: 'onya_konyvelo' }).catch(() => undefined);
          await regiCb.mutateAsync({ ...(norm ? { phone: norm, savePhoneToProfile: mentsd } : {}), topic: fajta === 'meghatalmazas' ? 'meghatalmazas' : 'vallalkozas_inditas', window: sav, source: 'bekotes', note: `${CALLBACK_TOPIC_LABELS[ASSIST_CALLBACK_TOPIC[fajta]]}.${megj.trim() ? ` ${megj.trim()}` : ''}`.slice(0, CALLBACK_RULES.noteMaxChars) });
          jelez({ szoveg: ASSIST_TEXTS.toast, kesz: true });
          bekotesre();
          return;
        } catch (e2) {
          setHiba(hibaUzenet(e2, 'Nem sikerült elküldeni. Próbáld újra.'));
          return;
        }
      }
      if (err instanceof ApiHiba && err.fields?.phone) setH((x) => ({ ...x, telefon: err.fields?.phone ?? TELEFON_HIBA }));
      // 11-19 javítás: jelszó / kód / adóazonosító a megjegyzésben – a szerver elutasítja, a mező alatt mondjuk meg
      if (err instanceof ApiHiba && err.fields?.note) setH((x) => ({ ...x, megj: err.fields?.note ?? ASSIST_TEXTS.noteRefused }));
      setHiba(hibaUzenet(err, 'Nem sikerült elküldeni. Próbáld újra.', { jelolt: ['phone'] }));
    }
  }

  if (evZarva) {
    return (
      <Kepernyo ful="fooldal" fejlec={fej}>
        <Lap style={{ padding: 18 }}>
          <T m={17} lh={1.5}>
            {ASSIST_TEXTS.disabled}
          </T>
          <GombE cim="Kérem a visszahívást" style={{ marginTop: 14 }} onPress={() => router.replace(visszahivasUt('bekotes', 'vallalkozas_inditas'))} />
        </Lap>
      </Kepernyo>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Kepernyo ful="fooldal" fejlec={fej} gorgetoRef={gorgeto}>
        {/* 11-19 javítás: a fő gomb már az elején (eddig ~2280 px-nél, a 7 lépéses lista és a dobozok alatt volt).
            Ha van mentett szám, azonnal kéri; ha nincs, a számhoz görget. */}
        <Lap style={{ padding: 16, marginBottom: 12 }}>
          <T m={16} lh={1.5}>
            {fajta === 'meghatalmazas'
              ? `Felhívunk, és ${fnK} beküldi helyetted a meghatalmazást. Te csak jóváhagyod az ONYA-ban.`
              : `Felhívunk, megbeszéljük, és ${fnK} meghatalmazottként bejelenti a vállalkozásodat.`}
          </T>
          {/* 11-19 javító kör 2: ha nincs mentett szám (minden friss ügyfél), a számmező és a küldés gomb ITT van, nem
              2,5 képernyővel lejjebb – a lista és a dobozok utána jönnek. */}
          {ujSzam ? <View style={{ marginTop: 14 }}>{telefonBlokk}</View> : null}
          {ujSzam ? <HibaSzoveg szoveg={hiba} /> : null}
          <GombE
            cim={ujSzam ? ASSIST_TEXTS.sendButton : `${ASSIST_TEXTS.sendButton} (${cb.data?.phoneOnFileMasked ?? ''})`}
            onPress={() => void kuld()}
            tolt={ker.isPending || regiCb.isPending}
            style={{ marginTop: 12 }}
          />
          <T m={14} lh={1.4} c={szin.halvany} style={{ marginTop: 6 }}>
            Lent megnézheted, hogyan megy, és megadhatod, mikor hívjunk (nem kötelező).
          </T>
        </Lap>
        <IgyMegy fajta={fajta} fn={fn} />
        <T m={15.5} lh={1.5} style={{ marginTop: 12, paddingHorizontal: 4 }}>
          {ASSIST_TEXTS.needs}
        </T>
        <SohaBelepes fn={fn} style={{ marginTop: 12 }} />
        <T m={15.5} s={650} lh={1.45} style={{ marginTop: 10, paddingHorizontal: 4 }}>
          {ASSIST_TEXTS.free}
        </T>

        <Szakasz cim={ujSzam ? 'Mikor hívjunk?' : 'Mikor és hol hívjunk?'} />
        <Lap style={{ padding: 18, gap: 18 }}>
          {!ujSzam ? (
            <View>
              <T m={15} s={600} style={{ marginBottom: 7 }}>
                Telefonszám
              </T>
              <View style={{ borderRadius: forma.mezo, borderWidth: 1, borderColor: szin.keret, backgroundColor: szin.mezoAlap, padding: 14 }}>
                <T m={17} s={650} szam nyers>
                  {cb.data?.phoneOnFileMasked}
                </T>
                <T m={15} c={szin.halvany} lh={1.4} style={{ marginTop: 2 }}>
                  Ezen hívjunk?
                </T>
                <GombSz cim="Másik számot adok meg" onPress={() => setMasikSzam(true)} style={{ paddingBottom: 0 }} />
              </View>
            </View>
          ) : null}
          <View>
            <T m={15} s={600} style={{ marginBottom: 6 }}>
              Miben segítsünk?
            </T>
            <View style={{ borderRadius: forma.mezo, backgroundColor: szin.nyomott, paddingVertical: 10, paddingHorizontal: 12 }}>
              <T m={15.5} s={650} lh={1.4}>
                {CALLBACK_TOPIC_LABELS[ASSIST_CALLBACK_TOPIC[fajta]]}
              </T>
            </View>
          </View>
          <View>
            <T m={15} s={600} style={{ marginBottom: 8 }}>
              Mikor hívhatunk?
            </T>
            <Valaszto elemek={igeret.windows.map((w) => ({ kulcs: w.window, cim: w.label }))} ertek={sav} valt={setSav} />
          </View>
          <Mezo
            felirat="Megjegyzés (nem kötelező)"
            value={megj}
            onChangeText={(t) => {
              setMegj(t.slice(0, CALLBACK_RULES.noteMaxChars));
              if (h.megj) setH((x) => ({ ...x, megj: null }));
            }}
            placeholder="Például: mikor érsz rá, mi nem világos."
            multiline
            maxLength={CALLBACK_RULES.noteMaxChars}
            hiba={h.megj}
            sugo={`${ASSIST_TEXTS.noteHint} ${megj.length}/${CALLBACK_RULES.noteMaxChars}`}
          />
        </Lap>
        <View style={{ marginTop: 12 }}>
          <Igeret p={igeret} />
        </View>
        {ujSzam ? null : <HibaSzoveg szoveg={hiba} />}
        <GombE cim={ASSIST_TEXTS.sendButton} onPress={() => void kuld()} tolt={ker.isPending || regiCb.isPending} style={{ marginTop: 16 }} />
        <GombM
          cim={fajta === 'meghatalmazas' ? 'Inkább magam adom meg' : 'Inkább magam jelentem be'}
          onPress={() => router.replace(lepesre(fajta === 'meghatalmazas' ? '/bekotes/meghatalmazas?mod=magam' : '/bekotes/vallalkozas') as never)}
          style={{ marginTop: 12 }}
        />
      </Kepernyo>
    </KeyboardAvoidingView>
  );
}
