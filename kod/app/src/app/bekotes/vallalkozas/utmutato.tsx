// S10 – „Így jelentsd be a vállalkozásodat”: a személyre szabott útmutató LÉPÉSENKÉNT (?lepes=N; 0 = bevezető videóval,
// „Készítsd elő”-vel és a rajzolt képek megjegyzésével). Minden lépés: a NAV-képernyő neve, mit csinálj, mezősorok, a
// kép az őszinte kis sorral (valódi / rajzolt), „Megvan, tovább”, „Vissza”, „Elakadtál?”, és „Nem boldogulsz vele?
// Intézzük helyetted”. Amíg a tevékenység sora készül, a NAV-gomb helyett „Előbb megírjuk…”, a tartó lépéseken nincs
// „tovább”. Az utolsó gomb: „Feltöltöm az értesítést”. „Mutasd egyben” = a régi hosszú oldal (?egyben=1).
import { router, useLocalSearchParams } from 'expo-router';
import { Platform, View } from 'react-native';
import type { Guide } from '@/_shared/api';
import { ASSIST_TEXTS, fillPlaceholders } from '@/_shared/bekotes';
import { ApiHiba } from '@/api/http';
import { useMe, useProfil, useUtmutato, useUtmutatoHaladas, useUtmutatoKepek } from '@/api/hooks';
import { maiNap } from '@/lib/format';
import { helyettunkUt, nyitott, segitsegFajta } from '@/lib/ut';
import { utmutatoEpit } from '@/lib/utmutato';
import { SavCim, SegitsegCsik, useElokeszit, useHaladas, useLepesParam, UtmutatoLepesenkent, UtmutatoTorzs } from '@/kepernyok/Utmutato';
import { szin } from '@/theme/tokens';
import { GombE, GombM, GombSz, Lap } from '@/ui/alap';
import { Ikon3d } from '@/ui/kepek';
import { SohaBelepes } from '@/ui/Helyettunk';
import { Betolt, Hiba, Kepernyo, vissza } from '@/ui/keret';
import { T } from '@/ui/T';
import { useEvSegitseg, useUt } from '@/ui/Ut';
import { Elakadtal } from '@/ui/Visszahivas';
import { csakInditasUton } from '@/ui/UtVedelem';
import { vezetettHref, vezetettKulcs } from '@/lib/vezetett';

/** SPEC §29.10: inside the guided run the upload is the next guided step ('ertesites'). */
const feltoltesUt = () => (vezetettKulcs() ? vezetettHref('/bekotes/vallalkozas/feltoltes', 'ertesites') : '/bekotes/vallalkozas/feltoltes');

function BejelentesUtmutato() {
  const me = useMe();
  const evNyitva = useEvSegitseg();
  const { o, reg } = useUt();
  const p = useLocalSearchParams<{ egyben?: string }>();
  const profil = useProfil();
  const q = useUtmutato('vallalkozas_bejelentes');
  const kepek = useUtmutatoKepek('vallalkozas_bejelentes');
  const haladasMent = useUtmutatoHaladas('vallalkozas_bejelentes');
  const elokeszit = useElokeszit(me.data?.user.id);
  const r = reg.data?.registration ?? null;
  const fn = o.data?.accountant.firstName ?? 'a könyvelőd';
  // Régebbi szerver (nincs még /client/guides): ugyanabból a sablonból itt építjük fel.
  const nincsVegpont = q.error instanceof ApiHiba && q.error.status === 404 && q.error.code === 'not_found';
  const g: Guide | undefined =
    q.data ??
    (nincsVegpont && r && o.data
      ? utmutatoEpit('vallalkozas_bejelentes', {
          answers: r.answers,
          nev: `${profil.data?.lastName ?? ''} ${profil.data?.firstName ?? ''}`.trim(),
          lakcim: profil.data?.address?.zip ? profil.data.address : null,
          konyvelo: { nev: o.data.accountant.displayName, firstName: fn, adoazonosito: null, nyilvantartasiSzam: o.data.accountant.registrationNumber },
          ugykorok: [],
          kesz: r.guideProgress,
          ma: maiNap(),
        })
      : undefined);
  const h = useHaladas('vallalkozas_bejelentes', g, (k) => haladasMent.mutateAsync(k));
  const lp = useLepesParam(g?.steps.length ?? 0);
  const egyben = p.egyben === '1';
  const ev = segitsegFajta(o.data?.assists, 'vallalkozas_bejelentes');
  const segitsegLink = evNyitva && !nyitott(ev) && (!r || ['kitoltes', 'utmutato'].includes(r.status)) ? () => router.push(helyettunkUt('vallalkozas_bejelentes', 'vallalkozas_utmutato', vezetettKulcs())) : null;
  const feltolthet = !!r && ['utmutato', 'javitas'].includes(r.status);
  const fej = (
    <SavCim
      vissza={() => (!egyben && lp.lepes > 0 ? lp.ugrik(lp.lepes - 1) : vissza('/bekotes'))}
      visszaCim={!egyben && lp.lepes > 0 ? 'Vissza' : 'Vissza a Főoldalra'}
      cim={g?.title ?? 'Így jelentsd be a vállalkozásodat'}
      al={g?.activityPending ? 'Előbb megírjuk a tevékenységed sorát (általában 1 munkanap). Utána kb. 10–15 perc.' : 'Kb. 10–15 perc, ingyenes. Te küldöd be, mi átnézzük.'}
    />
  );

  // 11-19 javítás: amíg az „Intézzük helyetted” kérés él, ezt Bence küldi be – az önkiszolgáló útmutató NEM jelenik meg
  // (különben az ügyfél is beküldhetné, és kettős bejelentés lenne, nem tervezett kezdőnappal).
  if (nyitott(ev) || r?.mode === 'segitett') {
    const engedelyezhet = !!ev && ev.canConsent;
    return (
      <Kepernyo ful="fooldal" fejlec={<SavCim vissza={() => vissza('/bekotes')} visszaCim="Vissza a Főoldalra" cim="Intézzük helyetted a bejelentést" al={`${fn} meghatalmazottként küldi be, a saját belépésével.`} />}>
        <View style={{ backgroundColor: szin.lap, borderRadius: 18, borderWidth: 2, borderColor: szin.tintakek, padding: 16 }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
            <Ikon3d nev="bevallas" pt={44} />
            <T m={17} s={600} lh={1.5} style={{ flex: 1 }}>
              {fillPlaceholders(ASSIST_TEXTS.guideAssistBanner, { firstName: fn })}
            </T>
          </View>
          {engedelyezhet ? <GombE cim={ASSIST_TEXTS.guideAssistButton} onPress={() => router.push('/bekotes/vallalkozas/engedely')} style={{ marginTop: 14 }} /> : null}
          <GombM cim="Megnézem, hol tart" onPress={() => router.push('/bekotes/vallalkozas')} style={{ marginTop: engedelyezhet ? 10 : 14 }} />
        </View>
        <SohaBelepes fn={fn} style={{ marginTop: 12 }} />
        <Elakadtal forras="vallalkozas_utmutato" tema="vallalkozas_inditas" style={{ marginTop: 6, marginLeft: 4 }} />
      </Kepernyo>
    );
  }
  if (q.error instanceof ApiHiba && q.error.code === 'step_locked') {
    return (
      <Kepernyo ful="fooldal" fejlec={fej}>
        <Lap style={{ padding: 18 }}>
          <T m={17} lh={1.5}>
            Előbb válaszolj pár kérdésre a kérdőívben. Ebből készül a személyre szabott útmutatód.
          </T>
          <GombM cim="Kitöltöm a kérdőívet" onPress={() => router.replace('/bekotes/vallalkozas/adatlap')} style={{ marginTop: 14 }} />
        </Lap>
        {/* 11-19 javító kör 2: a kiemelt „Intézzük helyetted” itt is (eddig csak a vékony „Elakadtál?” link volt). */}
        {segitsegLink ? <SegitsegCsik fajta="ev" fn={fn} onPress={segitsegLink} style={{ marginTop: 12 }} /> : null}
        <Elakadtal forras="vallalkozas_utmutato" tema="vallalkozas_inditas" style={{ marginLeft: 4 }} />
      </Kepernyo>
    );
  }
  if (!g) {
    return (
      <Kepernyo ful="fooldal" fejlec={fej}>
        {q.isLoading || reg.isLoading ? <Betolt /> : <Hiba hiba={q.error} ujra={() => void q.refetch()} />}
        <Elakadtal forras="vallalkozas_utmutato" tema="vallalkozas_inditas" style={{ marginTop: 6, marginLeft: 4 }} />
      </Kepernyo>
    );
  }
  if (egyben) {
    return (
      <Kepernyo ful="fooldal" fejlec={fej}>
        {segitsegLink ? <SegitsegCsik fajta="ev" fn={fn} onPress={segitsegLink} style={{ marginBottom: 12 }} /> : null}
        <UtmutatoTorzs g={g} kepek={kepek.data} valaszok={{ workKind: r?.answers.workKind, euPartner: r?.answers.euPartner }} kesz={h.kesz} valt={h.valt} fn={fn} pipak={elokeszit.pipak} pipal={elokeszit.valt} />
        {feltolthet ? (
          <GombE cim="Feltöltöm az értesítést" onPress={() => router.push(feltoltesUt() as never)} style={{ marginTop: 18 }} />
        ) : r ? (
          <T m={15.5} lh={1.5} c={szin.halvanyAlapon} style={{ marginTop: 16, paddingHorizontal: 4 }}>
            {r.statusText}
          </T>
        ) : null}
        <GombSz cim="Lépésenként mutasd" onPress={() => router.setParams({ egyben: undefined, lepes: '0' })} style={{ marginLeft: 4 }} />
        {/* ÁSZF 4/C.9: aki NAV-ügyfélszolgálaton, papírral intézi, kinyomtathatja a személyre szabott útmutatót (csak weben). */}
        {Platform.OS === 'web' && typeof window !== 'undefined' && typeof window.print === 'function' ? (
          <GombSz cim="Kinyomtatom az útmutatót" onPress={() => window.print()} style={{ marginLeft: 4 }} />
        ) : null}
        <Elakadtal forras="vallalkozas_utmutato" tema="vallalkozas_inditas" style={{ marginLeft: 4 }} />
      </Kepernyo>
    );
  }
  return (
    <Kepernyo ful="fooldal" gorgetoRef={lp.gorgeto} fejlec={fej}>
      <UtmutatoLepesenkent
        g={g}
        kepek={kepek.data}
        valaszok={{ workKind: r?.answers.workKind, euPartner: r?.answers.euPartner }}
        kesz={h.kesz}
        valt={h.valt}
        fn={fn}
        pipak={elokeszit.pipak}
        pipal={elokeszit.valt}
        lepes={lp.lepes}
        ugrik={lp.ugrik}
        vege={feltolthet ? { cim: 'Feltöltöm az értesítést', onPress: () => router.push(feltoltesUt() as never) } : null}
        segitseg={segitsegLink}
        egyben={() => router.setParams({ egyben: '1' })}
      />
    </Kepernyo>
  );
}

/** k5 #2: csak az „inditas” úton (különben vissza a bekötés Főoldalára). */
export default csakInditasUton(BejelentesUtmutato);
