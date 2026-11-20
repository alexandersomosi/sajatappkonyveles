// S8 – Vállalkozás bejelentése, a lépés központja (SPEC §27.4.4). A sávon az állapot; alatta EGY aktuális kártya
// (kérdőív / útmutató / javítás / várakozás + adószám / kész + kamara); önkiszolgálásnál a kiemelt „Nem boldogulsz
// vele? Intézzük helyetted” kártya, „Intézzük helyetted” módban a kérés állapota és a következő teendő (jóváhagyás,
// végső engedély). „Készítsd elő” összecsukva. Legalul a halk „Mégsem most?” (a piros „Leállítom” gomb megszűnt).
// Régi változat: kod/app/_regi/elotte_tulaj1119/src/app/bekotes/vallalkozas/index.tsx.
import { useState } from 'react';
import { Linking, View } from 'react-native';
import { router } from 'expo-router';
import { ACTIVITY_PENDING_BANNER, ASSIST_TEXTS, fillPlaceholders, HUB_TEXTS, KAMARA_TEXTS, ONYA_URL, PREPARE_ITEMS, REGISTRATION_FIX_CHANNEL_TEXT, UGYSEGED_URL } from '@/_shared/bekotes';
import { REGISTRATION_STATUS_CLIENT_TEXT, type RegistrationWithdrawReason } from '@/_shared/enums';
import { ApiHiba } from '@/api/http';
import { useMe, useVallalkozasAdoszam, useVallalkozasLeallit } from '@/api/hooks';
import { datumAn } from '@/lib/format';
import { hibaUzenet } from '@/lib/hiba';
import { adoszamAfaMentesHiba, adoszamFormaz } from '@/lib/validators';
import { elo, helyettunkUt, segitsegFajta } from '@/lib/ut';
import { vezetettKulcs } from '@/lib/vezetett';
import { ElokeszitLista, SavCim, useElokeszit } from '@/kepernyok/Utmutato';
import { forma, szin } from '@/theme/tokens';
import { GombE, GombM, GombSz, HibaSzoveg, Lap } from '@/ui/alap';
import { JovahagyasKartya } from '@/ui/Helyettunk';
import { Ikon3d, KeszJel, Targykep } from '@/ui/kepek';
import { AlsoLap, Betolt, Hiba, Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { HolTalalom } from '@/ui/Magyarazat';
import { Mezo } from '@/ui/Mezo';
import { T } from '@/ui/T';
import { useEvSegitseg, KiemeltKartya, SegitsegAllapot, useUt, useUtvaltas, VarakozasKartya } from '@/ui/Ut';
import { Elakadtal } from '@/ui/Visszahivas';
import { csakInditasUton } from '@/ui/UtVedelem';

function AdoszamUrlap({ fn }: { fn: string }) {
  const ment = useVallalkozasAdoszam();
  const jelez = useJelzes();
  const [a, setA] = useState('');
  const [ev, setEv] = useState('');
  const [h, setH] = useState<string | null>(null);
  const [hiba, setHiba] = useState<string | null>(null);
  return (
    <Lap style={{ padding: 18, marginTop: 12, gap: 12 }}>
      <T m={17} s={650} lh={1.4}>
        Megvan az adószámod?
      </T>
      <T m={15.5} lh={1.5} c={szin.halvany} style={{ marginTop: -6 }}>
        {`A NAV-os értesítésen vagy a Vállalkozói Ügysegédben látod. Ha beírod, ${fn} hamarabb tud indulni.`}
      </T>
      <View>
        <Mezo felirat="Adószám" value={a} onChangeText={(t) => { setA(adoszamFormaz(t)); setH(null); }} keyboardType="number-pad" placeholder="12345678-1-23" hiba={h} />
        <HolTalalom kulcs="adoszam" forras="vallalkozas_utmutato" tema="vallalkozas_inditas" />
      </View>
      <Mezo felirat="Nyilvántartási szám (ha tudod)" value={ev} onChangeText={(t) => setEv(t.replace(/\D/g, '').slice(0, 8))} keyboardType="number-pad" />
      <HibaSzoveg szoveg={hiba} />
      <GombM
        cim="Beírom az adószámot"
        tolt={ment.isPending}
        onPress={async () => {
          const e = adoszamAfaMentesHiba(a);
          setH(e);
          if (e) return;
          setHiba(null);
          try {
            await ment.mutateAsync({ adoszam: adoszamFormaz(a), evNyilvantartasiSzam: ev || undefined });
            jelez({ szoveg: 'Köszönjük, rögzítettük.', kesz: true });
          } catch (err) {
            if (err instanceof ApiHiba && err.fields?.adoszam) setH(err.fields.adoszam);
            setHiba(hibaUzenet(err, 'Nem sikerült menteni. Próbáld újra.', { jelolt: ['adoszam'] }));
          }
        }}
      />
    </Lap>
  );
}

/** Egy aktuális teendő kártyája (cím, egy mondat, egy elsődleges gomb). */
function Teendo({ ikon = 'bevallas', cim, szoveg, gomb, onPress, children }: { ikon?: 'bevallas' | 'irat' | 'igazolas' | 'tepnaptar'; cim: string; szoveg: string; gomb: string; onPress: () => void; children?: React.ReactNode }) {
  return (
    <Lap style={{ padding: 18 }}>
      <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
        <Ikon3d nev={ikon} pt={44} />
        <T m={19} s={700} lh={1.3} style={{ flex: 1 }} accessibilityRole="header">
          {cim}
        </T>
      </View>
      <T m={16} lh={1.5} c={szin.halvany} style={{ marginTop: 8 }}>
        {szoveg}
      </T>
      {children}
      <GombE cim={gomb} onPress={onPress} style={{ marginTop: 16 }} />
    </Lap>
  );
}

function VallalkozasKozpont() {
  const me = useMe();
  const { o, j, reg: q } = useUt();
  const utv = useUtvaltas();
  const evNyitva = useEvSegitseg();
  const leallit = useVallalkozasLeallit();
  const jelez = useJelzes();
  const elokeszit = useElokeszit(me.data?.user.id);
  const [megsemLap, setMegsemLap] = useState(false);
  const [elokeszitNyitva, setElokeszitNyitva] = useState(false);
  const fn = o.data?.accountant.firstName ?? me.data?.accountant?.firstName ?? 'a könyvelőd';
  const r = q.data?.registration ?? null;
  const allapot = r?.status ?? 'kitoltes';
  const ev = segitsegFajta(o.data?.assists, 'vallalkozas_bejelentes');
  const segitett = elo(ev);
  const fej = <SavCim vissza={() => vissza('/bekotes')} visszaCim="Vissza a Főoldalra" cim="Vállalkozás bejelentése" al={segitett ? `Intézzük helyetted: ${fn} meghatalmazottként jelenti be, te jóváhagyod.` : (r?.statusText ?? REGISTRATION_STATUS_CLIENT_TEXT[allapot])} />;
  if (q.isLoading || o.isLoading) return <Kepernyo ful="fooldal" fejlec={fej}><Betolt /></Kepernyo>;
  if (q.error && !(q.error instanceof ApiHiba && q.error.status === 404)) return <Kepernyo ful="fooldal" fejlec={fej}><Hiba hiba={q.error} ujra={() => void q.refetch()} /></Kepernyo>;
  const prepare = PREPARE_ITEMS.map((p) => ({ key: p.key, label: p.label, note: p.note, explainerKey: p.explainer, storedByUs: p.storedByUs, privacyNote: p.privacyNote }));
  const elkezdte = !!r && (r.answers.revenueBand != null || r.answers.activities.length > 0 || r.answers.declarations != null);
  const adatokHianyzik = !!o.data && o.data.steps.find((s) => s.step === 'adatok')?.status !== 'kesz';
  const bekuldve = ['beadva', 'javitas', 'ellenorizve', 'kesz'].includes(allapot);
  const kerdoivre = () => router.push(adatokHianyzik ? { pathname: '/bekotes/adatok', params: { utana: 'adatlap', utanaLap: '1' } } : '/bekotes/vallalkozas/adatlap');
  const kerdoivGomb = adatokHianyzik ? 'Megadom az adataimat' : elkezdte ? 'Folytatom a kérdőívet' : 'Kitöltöm';
  const kerdoivSzoveg = adatokHianyzik
    ? 'Előbb pár adat rólad (név, telefon, adóazonosító jel, lakcím), utána jön a kérdőív. Kb. 5–8 perc.'
    : 'Pár kérdés a vállalkozásodról, kb. 5–8 perc. Ebből készül a személyre szabott útmutatód.';
  const kamaraSor = j?.steps.find((s) => s.key === 'kamara');
  const megsemOk = async (ok: RegistrationWithdrawReason) => {
    try {
      await leallit.mutateAsync({ reason: ok });
      setMegsemLap(false);
      jelez({ szoveg: 'Rendben. Bármikor újrakezdheted, a válaszaid megmaradnak.', kesz: true });
      router.navigate('/bekotes');
    } catch (e) {
      jelez(hibaUzenet(e, 'Nem sikerült. Próbáld újra.'));
    }
  };

  // ---------- „Intézzük helyetted” mód ----------
  if (segitett && ev) {
    const kerdoivKesz = !!r && r.status !== 'kitoltes';
    return (
      <Kepernyo ful="fooldal" fejlec={fej}>
        <SegitsegAllapot a={ev} fn={fn} cb={o.data?.callback ?? null} />
        {ev.status === 'meghatalmazas_bekuldve' || ev.status === 'meghatalmazas_lejart' ? <JovahagyasKartya a={ev} fn={fn} /> : null}
        {!kerdoivKesz ? (
          <View style={{ marginTop: 12 }}>
            <Teendo cim="Kérdőív a vállalkozásodról" szoveg={`${kerdoivSzoveg} Ezekkel az adatokkal jelenti be ${fn}.`} gomb={kerdoivGomb} onPress={kerdoivre} />
          </View>
        ) : ev.canConsent && !(ev.consent?.valid) ? (
          <View style={{ marginTop: 12 }}>
            <Teendo ikon="igazolas" cim={ASSIST_TEXTS.consentTitle} szoveg={ev.consent && !ev.consent.valid ? ASSIST_TEXTS.consentStale : fillPlaceholders(ASSIST_TEXTS.consentSub, { firstName: fn })} gomb="Átnézem és engedélyezem" onPress={() => router.push('/bekotes/vallalkozas/engedely')} />
          </View>
        ) : ev.status === 'bejelentes_bekuldve' || ev.status === 'kesz' ? (
          <Lap style={{ padding: 18, marginTop: 12, alignItems: 'center' }}>
            <KeszJel pt={44} />
            <T m={19} s={700} lh={1.3} kozep style={{ marginTop: 8 }}>
              {ASSIST_TEXTS.filedTitle}
            </T>
            <T m={16} lh={1.5} c={szin.halvany} kozep style={{ marginTop: 6 }}>
              {fillPlaceholders(ASSIST_TEXTS.filedBody, { date: r?.filed?.filedOn ? datumAn(r.filed.filedOn) : 'a minap' })}
            </T>
            {r?.filed?.documentId ? <GombM cim={ASSIST_TEXTS.filedButton} onPress={() => router.push(`/tetel/${r.filed!.documentId}` as never)} style={{ marginTop: 12, alignSelf: 'center' }} /> : null}
          </Lap>
        ) : j?.waiting ? (
          <VarakozasKartya w={j.waiting} forras="vallalkozas_utmutato" />
        ) : null}
        {allapot === 'kesz' && kamaraSor && kamaraSor.state !== 'kesz' ? (
          <View style={{ marginTop: 12 }}>
            <Teendo ikon="tepnaptar" cim={KAMARA_TEXTS.title} szoveg={kamaraSor.dueText ?? KAMARA_TEXTS.body} gomb="Megnézem" onPress={() => router.push('/bekotes/vallalkozas/kamara')} />
          </View>
        ) : null}
        <GombSz cim="Így megy, és mit csinálunk mi" onPress={() => router.push(helyettunkUt('vallalkozas_bejelentes', 'helyettunk_vallalkozas', vezetettKulcs()))} style={{ marginTop: 10, marginLeft: 4 }} />
        <Elakadtal forras="vallalkozas_utmutato" tema="vallalkozas_bejelentes_helyettem" style={{ marginLeft: 4 }} />
      </Kepernyo>
    );
  }

  // ---------- önkiszolgáló ----------
  return (
    <Kepernyo ful="fooldal" fejlec={fej}>
      {allapot === 'kitoltes' || allapot === 'elallt' ? (
        <Teendo cim="Kérdőív a vállalkozásodról" szoveg={kerdoivSzoveg} gomb={kerdoivGomb} onPress={kerdoivre} />
      ) : allapot === 'utmutato' ? (
        <Lap style={{ padding: 18 }}>
          <Targykep nev="tepnaptar_3d" style={{ marginBottom: 6 }} />
          {/* 11-19 javító kör 2: amíg a tevékenység-sort írjuk, nem „kész” az útmutató – ne mondjon mást a cím, mint a sárga doboz. */}
          <T m={19} s={700} lh={1.3} kozep>
            {r?.activityPending ? 'Már átnézheted az útmutatót' : 'Kész a személyre szabott útmutatód'}
          </T>
          {/* amíg a sor készül, a sárga doboz mondja el egyszer, mi van (a sáv alcíme is) – itt nem ismételjük */}
          {r?.activityPending ? null : (
            <T m={16} lh={1.5} c={szin.halvany} kozep style={{ marginTop: 6 }}>
              {`${r?.guideProgress.length ? `${r.guideProgress.length} lépés megvan. ` : ''}A vállalkozásod azon a napon indul, amikor beküldöd a bejelentést.`}
            </T>
          )}
          {r?.activityPending ? (
            <View style={{ marginTop: 14, borderRadius: forma.mezo, backgroundColor: szin.borostyanAlap, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
              <Ikon3d nev="ora" pt={32} />
              <T m={15.5} s={600} lh={1.5} c={szin.borostyanSzoveg} style={{ flex: 1 }}>
                {ACTIVITY_PENDING_BANNER}
              </T>
            </View>
          ) : null}
          <GombE cim="Megnyitom az útmutatót" onPress={() => router.push('/bekotes/vallalkozas/utmutato')} style={{ marginTop: 16 }} />
          <GombSz cim="Beküldtem, feltöltöm az értesítést" onPress={() => router.push('/bekotes/vallalkozas/feltoltes')} style={{ alignSelf: 'center', marginTop: 6 }} />
          <GombSz cim="Módosítom a válaszaimat" onPress={() => router.push({ pathname: '/bekotes/vallalkozas/adatlap', params: { lap: '5' } })} style={{ alignSelf: 'center' }} />
        </Lap>
      ) : allapot === 'javitas' ? (
        <>
          <View style={{ borderRadius: forma.lap, backgroundColor: szin.borostyanAlap, padding: 18 }}>
            <T m={14} s={700} ls={0.04} c={szin.borostyanSzoveg}>
              EZT KELL JAVÍTANOD
            </T>
            <T m={17} s={600} lh={1.5} c={szin.borostyanSzoveg} style={{ marginTop: 4 }}>
              {r?.fixNote ?? 'Megírtuk az Üzenetekben, mit és hogyan.'}
            </T>
            <T m={15} lh={1.5} c={szin.borostyanSzoveg} style={{ marginTop: 8 }}>
              {REGISTRATION_FIX_CHANNEL_TEXT}
            </T>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', columnGap: 18, marginTop: 4 }}>
              <GombSz cim="Megnyitom az Ügysegédet" c={szin.borostyanSzoveg} accessibilityRole="link" onPress={() => void Linking.openURL(UGYSEGED_URL)} />
              <GombSz cim="Megnyitom az ONYA-t" c={szin.borostyanSzoveg} accessibilityRole="link" onPress={() => void Linking.openURL(ONYA_URL)} />
            </View>
          </View>
          <GombE cim="Feltöltöm az új értesítést" onPress={() => router.push('/bekotes/vallalkozas/feltoltes')} style={{ marginTop: 16 }} />
          <GombSz cim="Megnyitom az útmutatót" onPress={() => router.push('/bekotes/vallalkozas/utmutato')} style={{ marginTop: 4, marginLeft: 4 }} />
          <AdoszamUrlap fn={fn} />
        </>
      ) : allapot === 'beadva' || allapot === 'ellenorizve' ? (
        <>
          {j?.waiting && (j.waiting.key === 'atnezes' || j.waiting.key === 'adoszam') ? (
            <View style={{ marginTop: -12 }}>
              <VarakozasKartya w={j.waiting} forras="vallalkozas_utmutato" />
            </View>
          ) : (
            <Lap style={{ padding: 18, alignItems: 'center' }}>
              <Targykep nev={allapot === 'ellenorizve' ? 'befizetve_pecset' : 'level_boritek'} style={{ marginBottom: 6 }} />
              <T m={16} lh={1.5} c={szin.halvany} kozep>
                {r?.statusText}
              </T>
            </Lap>
          )}
          {r?.filed ? (
            <T m={14.5} lh={1.45} c={szin.halvanyAlapon} style={{ marginTop: 8, paddingHorizontal: 4 }}>
              {`Beküldted ${datumAn(r.filed.filedOn)}. Az értesítést ${datumAn(r.filed.uploadedAt)} töltötted fel.`}
            </T>
          ) : null}
          {r?.adoszam ? (
            <Lap style={{ padding: 18, marginTop: 12 }}>
              <T m={15} c={szin.halvany}>
                Az adószámod
              </T>
              <T m={20} s={700} szam nyers selectable>
                {r.adoszam}
              </T>
            </Lap>
          ) : (
            <AdoszamUrlap fn={fn} />
          )}
          <GombM cim="Vissza a Főoldalra" onPress={() => router.navigate('/bekotes')} style={{ marginTop: 12 }} />
        </>
      ) : allapot === 'kesz' ? (
        <Lap style={{ padding: 18, alignItems: 'center' }}>
          <KeszJel pt={44} />
          <T m={20} s={700} lh={1.3} kozep style={{ marginTop: 8 }}>
            Elindult a vállalkozásod!
          </T>
          <T m={16} lh={1.5} c={szin.halvany} kozep style={{ marginTop: 6 }}>
            {r?.adoszam ? `Adószám: ${r.adoszam}. ` : ''}Jöhet a következő lépés.
          </T>
          {kamaraSor && kamaraSor.state !== 'kesz' ? (
            <>
              <T m={16} s={650} lh={1.5} kozep style={{ marginTop: 12 }}>
                {`${KAMARA_TEXTS.title}: ${kamaraSor.dueText ?? '5 munkanapon belül'}`}
              </T>
              <GombE cim="Megnézem, hogyan" onPress={() => router.push('/bekotes/vallalkozas/kamara')} style={{ marginTop: 12, alignSelf: 'stretch' }} />
            </>
          ) : (
            <GombE cim="Tovább a következő lépésre" onPress={() => router.navigate('/bekotes')} style={{ marginTop: 16, alignSelf: 'stretch' }} />
          )}
        </Lap>
      ) : null}

      {!bekuldve && evNyitva && allapot !== 'elallt' ? (
        <KiemeltKartya
          style={{ marginTop: 12 }}
          jelveny={ASSIST_TEXTS.evCardBadge}
          cim={ASSIST_TEXTS.evCardTitle}
          szoveg={fillPlaceholders(ASSIST_TEXTS.evCardBody, { firstName: fn })}
          gomb={ASSIST_TEXTS.cardButton}
          onPress={() => router.push(helyettunkUt('vallalkozas_bejelentes', 'helyettunk_vallalkozas', vezetettKulcs()))}
        />
      ) : null}

      {allapot === 'kitoltes' || allapot === 'utmutato' ? (
        <>
          <View style={{ marginTop: 12, borderRadius: forma.lap, backgroundColor: szin.lap, paddingVertical: 12, paddingHorizontal: 16 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Ikon3d nev="irat" pt={28} />
              <T m={16.5} s={650} style={{ flex: 1 }}>
                {`Készítsd elő (${elokeszit.pipak.length}/${prepare.length})`}
              </T>
              <GombSz cim={elokeszitNyitva ? 'Becsukom' : HUB_TEXTS.prepareShowAll} onPress={() => setElokeszitNyitva((x) => !x)} style={{ paddingVertical: 6 }} />
            </View>
            {!elokeszitNyitva ? (
              <T m={14.5} lh={1.45} c={szin.halvany} style={{ marginTop: 4 }}>
                {fillPlaceholders(HUB_TEXTS.prepareSummary, { n: String(prepare.length) })}
              </T>
            ) : null}
          </View>
          {elokeszitNyitva ? (
            <View style={{ marginTop: 8 }}>
              <ElokeszitLista elemek={prepare} pipak={elokeszit.pipak} valt={elokeszit.valt} fn={fn} />
            </View>
          ) : null}
        </>
      ) : null}

      <Elakadtal forras={allapot === 'kitoltes' ? 'vallalkozas_adatlap' : 'vallalkozas_utmutato'} tema="vallalkozas_inditas" style={{ marginTop: 6, marginLeft: 4 }} />
      {r?.canWithdraw && ['kitoltes', 'utmutato'].includes(allapot) ? <GombSz cim={HUB_TEXTS.stopLink} c={szin.halvany} onPress={() => setMegsemLap(true)} style={{ marginLeft: 4 }} /> : null}

      <AlsoLap lathato={megsemLap} bezar={() => setMegsemLap(false)}>
        <T m={21} s={700} lh={1.3} style={{ paddingRight: 80 }} accessibilityRole="header">
          {HUB_TEXTS.stopSheetTitle}
        </T>
        <T m={16} lh={1.5} c={szin.halvany} style={{ marginTop: 6, marginBottom: 10 }}>
          A válaszaid megmaradnak. Bármikor folytathatod.
        </T>
        {[
          { cim: HUB_TEXTS.stopMegisVan, al: 'Átállunk a meglévő vállalkozásra.', fut: () => { setMegsemLap(false); utv.modosit(); } },
          { cim: HUB_TEXTS.stopKesobb, al: 'Megállunk itt. Ha szólsz, folytatjuk.', fut: () => void megsemOk('kesobb_inditom') },
          { cim: HUB_TEXTS.stopMeggondoltam, al: 'Nem indítasz vállalkozást.', fut: () => void megsemOk('meggondolta') },
        ].map((x, i) => (
          <View key={x.cim} style={{ borderTopWidth: i ? 1 : 0, borderTopColor: szin.hajszal, paddingVertical: 4 }}>
            <GombSz cim={x.cim} onPress={x.fut} m={17} />
            {x.al ? (
              <T m={14.5} lh={1.4} c={szin.halvany} style={{ marginTop: -6, marginBottom: 6 }}>
                {x.al}
              </T>
            ) : null}
          </View>
        ))}
        <HibaSzoveg szoveg={leallit.isPending ? 'Mentjük…' : null} />
        <GombM cim="Mégsem, maradok" onPress={() => setMegsemLap(false)} style={{ alignSelf: 'center', marginTop: 12 }} />
      </AlsoLap>
    </Kepernyo>
  );
}

/** k5 #2: csak az „inditas” úton (különben vissza a bekötés Főoldalára). */
export default csakInditasUton(VallalkozasKozpont);
