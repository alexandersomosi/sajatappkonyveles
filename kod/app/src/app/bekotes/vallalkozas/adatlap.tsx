// S9 – Kérdőív a vállalkozásodról (SPEC §27.4.4, korábban „adatlap”): az 1. lapon két pipa (a kizáró okok a „Mi ez?”
// mögött) és „Mégis van vállalkozásom” (S5); az 5. lapon az időarányos ÁFA- és átalány-határ; „Intézzük helyetted”
// módban a gomb „Kész, elküldöm”. Korábbi leírás: új vállalkozás adatlapja (SPEC §26.1.3): öt rövid lap, lapanként egy kérdéscsoport, „2/5” a sávon. A „Tovább”
// piszkozatként ment (PUT /client/business-registration), a „Vissza” semmit nem veszít el. Minden mezőnél „Hol találom?”,
// minden lap alján „Elakadtál? Kérj visszahívást”. A végén összefoglaló „Módosítom” linkekkel, majd „Kérem az útmutatót”.
// TAJ-t, anyja nevét, születési adatokat NEM kérünk: azokat az ügyfél a NAV-os űrlapba írja.
import { useEffect, useMemo, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, View, type ScrollViewInstance } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { BusinessRegistrationInput, BusinessRegistrationView } from '@/_shared/api';
import { ACTIVITY_NOT_FOUND_TEXT, ACTIVITY_QUALIFICATION_NOTE, BUSINESS_ACTIVITIES, KERDOIV_TEXTS, PATH_CHANGE_TEXTS, WHERE_TO_FIND_EXPLAINERS, fillPlaceholders, isValidHuZip, type ExplainerKey } from '@/_shared/bekotes';
import {
  REVENUE_BAND_LABELS, REVENUE_BANDS, SEAT_KIND_LABELS, SEAT_KINDS, SEAT_RIGHT_LABELS, WORK_KIND_LABELS, WORK_KINDS,
  type EuPartnerAnswer, type RevenueBand, type SeatKind, type SeatRight, type StartPlan, type WorkKind,
} from '@/_shared/enums';
import { ApiHiba } from '@/api/http';
import { useMe, useOnboarding, useProfil, useVallalkozas, useVallalkozasBekuld, useVallalkozasMent } from '@/api/hooks';
import { datumAn, datumIg, maiNap, napHozzaad, szam } from '@/lib/format';
import { nyitott, segitsegFajta } from '@/lib/ut';
import { useUtvaltas } from '@/ui/Ut';
import { hibaUzenet } from '@/lib/hiba';
import { jarulekSzoveg, koltseghanyadSzoveg, tevekenysegKeres } from '@/lib/tevekenyseg';
import { adoszamFormaz, adoszamHiba, datumHiba, datumNormal } from '@/lib/validators';
import { SavCim } from '@/kepernyok/Utmutato';
import { forma, szin } from '@/theme/tokens';
import { GombE, GombM, GombSz, HibaSzoveg, Lap, Pipa, Valaszto, jelzoDoboz } from '@/ui/alap';
import { Ikon3d } from '@/ui/kepek';
import { AlsoLap, Betolt, Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { HolTalalom, MiEz } from '@/ui/Magyarazat';
import { Mezo } from '@/ui/Mezo';
import { T } from '@/ui/T';
import { Elakadtal } from '@/ui/Visszahivas';
import { csakInditasUton } from '@/ui/UtVedelem';
import { bekotesre, vezetettKulcs } from '@/lib/vezetett';

const LAPOK = ['Mielőtt elkezded', 'Mivel foglalkozol?', 'Hol lesz a székhelyed?', 'Hogyan dolgozol majd?', 'Mikor indulsz?'];
const EU_LABELS: Record<EuPartnerAnswer, string> = { nem: 'Nem', igen: 'Igen', nem_tudom: 'Nem tudom' };
const MAX_TEVEKENYSEG = 5;

type Cim = { zip: string; city: string; line: string };
type Tev = { key: string | null; label: string; main: boolean };
type Urlap = {
  noExclusion: boolean; singleBusiness: boolean; revenueBand: RevenueBand | null;
  activities: Tev[]; activityFreeText: string;
  seatKind: SeatKind | null; seat: Cim; seatRight: SeatRight | null; providerName: string; providerAdoszam: string;
  vanTelephely: 'nincs' | 'van' | null; otherSites: Cim[];
  workKind: WorkKind | null; euPartner: EuPartnerAnswer | null; kulonSzamla: 'igen' | 'nem' | null;
  startPlan: StartPlan | null; startDate: string;
};
const URES_CIM: Cim = { zip: '', city: '', line: '' };
const URES: Urlap = {
  noExclusion: false, singleBusiness: false, revenueBand: null, activities: [], activityFreeText: '',
  seatKind: null, seat: URES_CIM, seatRight: null, providerName: '', providerAdoszam: '', vanTelephely: null, otherSites: [],
  workKind: null, euPartner: null, kulonSzamla: null, startPlan: null, startDate: '',
};

function urlapBol(r: BusinessRegistrationView | null): Urlap {
  if (!r) return URES;
  const a = r.answers;
  return {
    noExclusion: !!a.declarations?.noExclusion,
    singleBusiness: !!a.declarations?.singleBusiness,
    revenueBand: a.revenueBand,
    activities: a.activities.map((x) => ({ key: x.key, label: x.label, main: x.main })),
    activityFreeText: a.activityFreeText ?? '',
    seatKind: a.seat?.kind ?? null,
    seat: a.seat?.address ?? URES_CIM,
    seatRight: a.seat?.right ?? null,
    providerName: a.seat?.provider?.name ?? '',
    providerAdoszam: a.seat?.provider?.adoszam ?? '',
    vanTelephely: a.seat ? (a.otherSites.length ? 'van' : 'nincs') : null,
    otherSites: a.otherSites.map((s) => s.address),
    workKind: a.workKind,
    euPartner: a.euPartner,
    kulonSzamla: a.hasSeparateBusinessAccount == null ? null : a.hasSeparateBusinessAccount ? 'igen' : 'nem',
    startPlan: a.startPlan,
    startDate: a.startDate ?? '',
  };
}

/** Van-e már bármi kitöltve (a „válaszaid megmaradnak” mondathoz). */
const elkezdteE = (u: Urlap) => u.noExclusion || u.singleBusiness || u.revenueBand != null || u.activities.length > 0 || u.seatKind != null;

function lapAdat(u: Urlap, n: number): BusinessRegistrationInput {
  if (n === 1) return { declarations: { noExclusion: u.noExclusion, singleBusiness: u.singleBusiness }, ...(u.revenueBand ? { revenueBand: u.revenueBand } : {}) };
  if (n === 2) return { activities: u.activities.map((t) => ({ key: t.key, label: t.key ? undefined : t.label, main: t.main })), activityFreeText: u.activityFreeText.trim() || null };
  if (n === 3)
    return {
      ...(u.seatKind
        ? {
            seat: {
              kind: u.seatKind,
              address: u.seatKind === 'lakcim' ? null : { zip: u.seat.zip.trim(), city: u.seat.city.trim(), line: u.seat.line.trim() },
              right: u.seatKind === 'mas_cim' ? u.seatRight : u.seatKind === 'szekhelyszolgaltato' ? 'szekhelyszolgaltatasi_szerzodes' : null,
              provider: u.seatKind === 'szekhelyszolgaltato' ? { name: u.providerName.trim(), adoszam: adoszamFormaz(u.providerAdoszam) } : null,
            },
          }
        : {}),
      otherSites: u.vanTelephely === 'van' ? u.otherSites.map((c) => ({ address: { zip: c.zip.trim(), city: c.city.trim(), line: c.line.trim() } })) : [],
    };
  if (n === 4)
    return { ...(u.workKind ? { workKind: u.workKind } : {}), ...(u.euPartner ? { euPartner: u.euPartner } : {}), hasSeparateBusinessAccount: u.kulonSzamla == null ? null : u.kulonSzamla === 'igen' };
  return { ...(u.startPlan ? { startPlan: u.startPlan } : {}), startDate: u.startPlan === 'datum' && u.startDate ? datumNormal(u.startDate) : null };
}

/** A szerver mezőhibájából melyik lapra kell visszamenni. */
function lapMezohoz(mezo: string): number {
  if (/^(declarations|revenueBand)/.test(mezo)) return 1;
  if (/^activit/.test(mezo)) return 2;
  if (/^(seat|otherSites)/.test(mezo)) return 3;
  if (/^(workKind|euPartner|hasSeparate)/.test(mezo)) return 4;
  return 5;
}

/** Időarányos határ (Áfa tv. 188. §; átalány-plafon): a kezdés napjától az év végéig. */
function idoaranyos(teljes: number, kezd: string): number {
  const ev = Number(kezd.slice(0, 4));
  const napok = Math.round((Date.UTC(ev, 11, 31) - Date.UTC(ev, Number(kezd.slice(5, 7)) - 1, Number(kezd.slice(8, 10)))) / 86_400_000) + 1;
  const evNapjai = ev % 4 === 0 ? 366 : 365;
  return Math.round((teljes * Math.max(1, Math.min(evNapjai, napok))) / evNapjai);
}

function CimMezok({ c, al, h, elotag }: { c: Cim; al: (c: Cim) => void; h: Record<string, string | null | undefined>; elotag: string }) {
  return (
    <>
      <View style={{ flexDirection: 'row', gap: 10 }}>
        <Mezo felirat="Irányítószám" value={c.zip} onChangeText={(t) => al({ ...c, zip: t.replace(/\D/g, '').slice(0, 4) })} keyboardType="number-pad" hiba={h[`${elotag}.zip`]} style={{ width: 130 }} />
        <Mezo felirat="Település" value={c.city} onChangeText={(t) => al({ ...c, city: t.slice(0, 60) })} hiba={h[`${elotag}.city`]} style={{ flex: 1 }} />
      </View>
      <Mezo felirat="Utca, házszám" value={c.line} onChangeText={(t) => al({ ...c, line: t.slice(0, 120) })} hiba={h[`${elotag}.line`]} />
    </>
  );
}
function cimHibak(c: Cim, elotag: string): Record<string, string | null> {
  return {
    [`${elotag}.zip`]: isValidHuZip(c.zip.trim()) ? null : '4 számjegy, például 6720.',
    [`${elotag}.city`]: c.city.trim() ? null : 'Írd be a települést.',
    [`${elotag}.line`]: c.line.trim().length >= 3 ? null : 'Írd be az utcát és a házszámot.',
  };
}

function Kerdes({ cim, kulcs, children, hiba }: { cim: string; kulcs?: string; children: React.ReactNode; hiba?: string | null }) {
  return (
    <View>
      <T m={16} s={650} lh={1.4} style={{ marginBottom: kulcs ? 2 : 8 }}>
        {cim}
      </T>
      {kulcs ? (
        (WHERE_TO_FIND_EXPLAINERS as readonly string[]).includes(kulcs) ? (
          <HolTalalom kulcs={kulcs as ExplainerKey} forras="vallalkozas_adatlap" tema="vallalkozas_inditas" />
        ) : (
          <MiEz kulcs={kulcs} forras="vallalkozas_adatlap" tema="vallalkozas_inditas" style={{ alignSelf: 'flex-start', marginTop: -4, marginBottom: 4 }} />
        )
      ) : null}
      {children}
      {hiba ? (
        <T m={14.5} s={500} c={szin.veszely} lh={1.4} style={{ marginTop: 6 }} accessibilityLiveRegion="polite">
          {hiba}
        </T>
      ) : null}
    </View>
  );
}

function Tipp({ children, sarga }: { children: React.ReactNode; sarga?: boolean }) {
  return (
    <View style={[{ borderRadius: forma.mezo, padding: 14 }, sarga ? jelzoDoboz('figyelem') : { backgroundColor: szin.nyomott }]}>
      {typeof children === 'string' ? (
        <T m={15.5} s={sarga ? 600 : 400} lh={1.5} c={sarga ? szin.borostyanSzoveg : szin.tinta}>
          {children}
        </T>
      ) : (
        children
      )}
    </View>
  );
}

function Adatlap() {
  const p = useLocalSearchParams<{ lap?: string }>();
  const me = useMe();
  const o = useOnboarding();
  const profil = useProfil();
  const q = useVallalkozas();
  const ment = useVallalkozasMent();
  const bekuld = useVallalkozasBekuld();
  const utv = useUtvaltas();
  const jelez = useJelzes();
  const fn = o.data?.accountant.firstName ?? me.data?.accountant?.firstName ?? 'a könyvelőd';
  const [lap, setLapNyers] = useState(Math.min(5, Math.max(1, Number(p.lap) || 1)));
  // Lapváltáskor a görgető a tetejére megy (a következő lap címe és első kérdése látsszon).
  const gorgeto = useRef<ScrollViewInstance>(null);
  const setLap = (n: number) => {
    setLapNyers(n);
    requestAnimationFrame(() => gorgeto.current?.scrollTo({ y: 0, animated: false }));
  };
  const [u, setU] = useState<Urlap>(URES);
  const [betoltve, setBetoltve] = useState(false);
  const [h, setH] = useState<Record<string, string | null | undefined>>({});
  const [hiba, setHiba] = useState<string | null>(null);
  const [kereses, setKereses] = useState('');
  const [teljesLista, setTeljesLista] = useState(false);
  const r = q.data?.registration ?? null;
  const evSeg = segitsegFajta(o.data?.assists, 'vallalkozas_bejelentes');
  const segitett = r?.mode === 'segitett' || nyitott(evSeg);

  useEffect(() => {
    if (!betoltve && q.data) {
      setU(urlapBol(q.data.registration));
      setBetoltve(true);
    }
  }, [q.data, betoltve]);

  const al = <K extends keyof Urlap>(k: K) => (v: Urlap[K]) => {
    setU((x) => ({ ...x, [k]: v }));
    setH({});
  };
  const ma = maiNap();
  const talalatok = useMemo(() => tevekenysegKeres(kereses), [kereses]);
  const fo = u.activities.find((t) => t.main);
  const lakcim = profil.data?.address?.zip ? `${profil.data.address.zip} ${profil.data.address.city}, ${profil.data.address.line}` : null;
  // A „Rólad” adatok (név, telefon, adóazonosító jel, lakcím) nélkül a beküldés elbukik, és „A lakcímem” sem
  // választható székhelynek: ilyenkor az adatlap helyett előbb azt kérjük, és mentés után ide hozunk vissza.
  const adatokHianyzik = !!o.data && o.data.steps.find((s) => s.step === 'adatok')?.status !== 'kesz';
  const adatokhoz = () => router.push({ pathname: '/bekotes/adatok', params: { utana: 'adatlap', utanaLap: String(lap) } });
  const stop = u.revenueBand === 'tobb_20m' || (r?.hints.stop && lap === 1 && u.revenueBand === r.answers.revenueBand ? r.hints.stop : null);
  const kepesites = u.activities.some((t) => BUSINESS_ACTIVITIES.find((b) => b.key === t.key)?.kepesitesKellhet);

  function ellenoriz(n: number): boolean {
    const e: Record<string, string | null> = {};
    if (n === 1) {
      e.declarations = u.noExclusion && u.singleBusiness ? null : 'Pipáld be mindkettőt. Ha valamelyik nem igaz rád, kérj visszahívást.';
      e.revenueBand = u.revenueBand ? null : 'Válassz egyet.';
    } else if (n === 2) {
      e.activities = u.activities.length || u.activityFreeText.trim().length >= 3 ? null : 'Válassz legalább egyet, vagy írd le a saját szavaiddal.';
      if (u.activities.length && !fo) e.activities = 'Jelöld meg, melyik a fő tevékenységed.';
    } else if (n === 3) {
      e.seatKind = u.seatKind ? null : 'Válassz egyet.';
      if (u.seatKind && u.seatKind !== 'lakcim') Object.assign(e, cimHibak(u.seat, 'seat'));
      if (u.seatKind === 'mas_cim') e.seatRight = u.seatRight ? null : 'Válaszd ki, miért használhatod a címet.';
      if (u.seatKind === 'szekhelyszolgaltato') {
        e.providerName = u.providerName.trim() ? null : 'Írd be a székhelyszolgáltató nevét.';
        e.providerAdoszam = adoszamHiba(u.providerAdoszam);
      }
      e.vanTelephely = u.vanTelephely ? null : 'Válassz egyet.';
      if (u.vanTelephely === 'van') u.otherSites.forEach((c, i) => Object.assign(e, cimHibak(c, `otherSites.${i}`)));
    } else if (n === 4) {
      e.workKind = u.workKind ? null : 'Válassz egyet.';
      e.euPartner = u.euPartner ? null : 'Válassz egyet.';
    } else {
      e.startPlan = u.startPlan ? null : 'Válassz egyet.';
      if (u.startPlan === 'datum') {
        const d = datumNormal(u.startDate);
        e.startDate = datumHiba(u.startDate) ?? (d < ma ? 'Mai vagy későbbi nap legyen.' : d > napHozzaad(ma, 180) ? 'Legfeljebb fél évre előre.' : null);
      }
    }
    setH(e);
    return !Object.values(e).some(Boolean);
  }

  async function mentes(n: number): Promise<boolean> {
    setHiba(null);
    try {
      await ment.mutateAsync(lapAdat(u, n));
      return true;
    } catch (e) {
      if (e instanceof ApiHiba && e.fields) setH(e.fields);
      setHiba(hibaUzenet(e, 'Nem sikerült menteni. Próbáld újra.', { jelolt: Object.keys(h) }));
      return false;
    }
  }

  async function tovabb() {
    if (!ellenoriz(lap) || stop) return;
    if (!(await mentes(lap))) return;
    if (lap < 5) setLap(lap + 1);
  }

  async function utmutatotKerek() {
    if (!ellenoriz(5)) return;
    for (const n of [1, 2, 3, 4]) {
      if (!ellenoriz(n)) {
        setLap(n);
        return;
      }
    }
    if (!(await mentes(5))) return;
    try {
      const marBekuldte = !!r && r.status !== 'kitoltes';
      if (!marBekuldte) await bekuld.mutateAsync();
      if (segitett) {
        jelez({ szoveg: `Megkaptuk. Ezekkel az adatokkal jelenti be ${fn}.`, kesz: true });
        bekotesre();
        return;
      }
      jelez({ szoveg: marBekuldte ? 'Elmentettük. Az útmutatód frissült.' : 'Elkészült a személyre szabott útmutatód.', kesz: true });
      if (vezetettKulcs()) bekotesre();
      else router.replace('/bekotes/vallalkozas/utmutato');
    } catch (e) {
      if (e instanceof ApiHiba && e.fields) {
        setH(e.fields);
        // 'adatok' = a „Rólad” lap hiányzik: nem az adatlap egyik lapja, marad az összefoglaló, alatta a gomb.
        const elso = Object.keys(e.fields).find((k) => k !== 'adatok');
        if (elso) setLap(lapMezohoz(elso));
      }
      setHiba(hibaUzenet(e, 'Nem sikerült elküldeni. Próbáld újra.'));
    }
  }

  const tevHozzaad = (t: Tev) => {
    if (u.activities.some((x) => x.key && x.key === t.key)) return;
    if (u.activities.length >= MAX_TEVEKENYSEG) return jelez(`Legfeljebb ${MAX_TEVEKENYSEG} tevékenységet adhatsz meg: egy fő és négy másik.`);
    al('activities')([...u.activities, { ...t, main: !u.activities.some((x) => x.main) }]);
    setKereses('');
  };

  const fej = (
    <SavCim
      vissza={() => (lap > 1 ? setLap(lap - 1) : vissza('/bekotes/vallalkozas'))}
      visszaCim={lap > 1 ? `Vissza: ${LAPOK[lap - 2]}` : 'Vissza'}
      cim={KERDOIV_TEXTS.title}
      al={LAPOK[lap - 1]}
      jobb={`${lap}/5`}
    >
      <View style={{ flexDirection: 'row', gap: 6, marginTop: 12, paddingHorizontal: 20 }} accessibilityLabel={`${lap}. lap az 5-ből`}>
        {[1, 2, 3, 4, 5].map((i) => (
          <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= lap ? '#fff' : 'rgba(255,255,255,0.25)' }} />
        ))}
      </View>
    </SavCim>
  );
  if (q.isLoading || !betoltve) return <Kepernyo ful="fooldal" fejlec={fej}><Betolt /></Kepernyo>;
  if (adatokHianyzik)
    return (
      <Kepernyo ful="fooldal" fejlec={<SavCim vissza={() => vissza('/bekotes/vallalkozas')} visszaCim="Vissza" cim={KERDOIV_TEXTS.title} />}>
        <Lap style={{ padding: 18 }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Ikon3d nev="fiok" pt={44} />
            <T m={19} s={700} lh={1.3} style={{ flex: 1 }} accessibilityRole="header">
              {KERDOIV_TEXTS.gateTitle}
            </T>
          </View>
          <T m={16} lh={1.5} c={szin.halvany} style={{ marginTop: 8, marginBottom: 16 }}>
            {`A neved, a telefonszámod, az adóazonosító jeled és a lakcímed kell az útmutatódhoz. Egy rövid lap, utána ide hozunk vissza${elkezdteE(u) ? ', a válaszaid megmaradnak' : ''}.`}
          </T>
          <GombE cim="Megadom az adataimat" onPress={adatokhoz} />
        </Lap>
        <GombSz cim={PATH_CHANGE_TEXTS.kerdoivLink} onPress={utv.modosit} style={{ marginTop: 6, marginLeft: 4 }} />
        <Elakadtal forras="vallalkozas_adatlap" tema="vallalkozas_inditas" style={{ marginLeft: 4 }} />
      </Kepernyo>
    );

  // 5. lap: az időarányos határok a tervezett kezdéstől (k3_kor2 adó 5); a szerveré, ha ugyanarra a napra szól.
  const kezdNap = u.startPlan === 'datum' && !datumHiba(u.startDate) ? datumNormal(u.startDate) : ma;
  const kezdSzoveg = u.startPlan === 'datum' && kezdNap !== ma ? datumAn(kezdNap) : 'most';
  const ugyanaz = !!r && r.answers.startPlan === u.startPlan && (u.startPlan !== 'datum' || r.answers.startDate === kezdNap);
  // a szerver számait csak akkor vesszük át, ha ő is időarányosít (különben mindkettő itt, ugyanabból a napból)
  const szerverIdoaranyos = ugyanaz && !!r && r.hints.afaLimitHuf < 20_000_000;
  const afaHatar = szerverIdoaranyos && r ? r.hints.afaLimitHuf : idoaranyos(20_000_000, kezdNap);
  const atalanyHatar = szerverIdoaranyos && r ? r.hints.atalanyCapHuf : idoaranyos(38_736_000, kezdNap);
  const osszegzes = [
    { n: 1, cim: 'Bevétel', ertek: u.revenueBand ? REVENUE_BAND_LABELS[u.revenueBand] : '–' },
    { n: 2, cim: 'Tevékenységek', ertek: [...u.activities.map((t) => (t.main ? `${t.label} (fő)` : t.label)), ...(u.activityFreeText.trim() ? [u.activities.length ? `saját szavaiddal: „${u.activityFreeText.trim()}” (a sorát megírjuk)` : `„${u.activityFreeText.trim()}” (a sorát megírjuk)`] : [])].join(', ') || '–' },
    { n: 3, cim: 'Székhely', ertek: u.seatKind === 'lakcim' ? `A lakcímed${lakcim ? `: ${lakcim}` : ''}` : u.seatKind ? `${SEAT_KIND_LABELS[u.seatKind]}: ${u.seat.zip} ${u.seat.city}, ${u.seat.line}` : '–' },
    { n: 3, cim: 'Telephely, fióktelep', ertek: u.vanTelephely === 'van' ? u.otherSites.map((c) => `${c.zip} ${c.city}, ${c.line}`).join('; ') : 'Nincs' },
    { n: 4, cim: 'Munkavégzés', ertek: u.workKind ? WORK_KIND_LABELS[u.workKind] : '–' },
    { n: 4, cim: 'Más EU-országbeli cégek', ertek: u.euPartner ? EU_LABELS[u.euPartner] : '–' },
  ];

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Kepernyo ful="fooldal" fejlec={fej} gorgetoRef={gorgeto}>
        <Lap style={{ padding: 18, gap: 18 }}>
          {lap === 1 ? (
            <>
              <Kerdes cim="Két dolog rólad" hiba={h.declarations}>
                <Pipa be={u.noExclusion} valt={al('noExclusion')}>
                  <T m={16.5} s={600} lh={1.45}>
                    {KERDOIV_TEXTS.declNoExclusion}
                  </T>
                </Pipa>
                <MiEz kulcs="kizaro_okok" cim="Mik a kizáró okok?" forras="vallalkozas_adatlap" tema="vallalkozas_inditas" style={{ alignSelf: 'flex-start', marginLeft: 36, marginTop: -4 }} />
                <Pipa be={u.singleBusiness} valt={al('singleBusiness')} style={{ marginTop: 4 }}>
                  <T m={16.5} s={600} lh={1.45}>
                    {KERDOIV_TEXTS.declSingle}
                  </T>
                </Pipa>
                <GombSz cim={PATH_CHANGE_TEXTS.kerdoivLink} onPress={utv.modosit} />
              </Kerdes>
              <Kerdes cim="Évente nagyjából mennyi bevételre számítasz?" kulcs="varhato_bevetel" hiba={h.revenueBand}>
                <Valaszto elemek={REVENUE_BANDS.map((b) => ({ kulcs: b, cim: REVENUE_BAND_LABELS[b] }))} ertek={u.revenueBand} valt={al('revenueBand')} />
              </Kerdes>
              {stop ? (
                <View style={{ borderRadius: forma.mezo, ...jelzoDoboz('hiba'), padding: 14 }} accessibilityLiveRegion="polite">
                  <T m={16} s={650} lh={1.5} c={szin.veszelySzoveg}>
                    {typeof stop === 'object' ? stop.text : 'Ennyi bevétel mellett nem lehetsz alanyi ÁFA-mentes. Szolgáltatásunk most az ÁFA-mentes egyéni vállalkozóknak szól. Ha kérdésed van, kérj visszahívást.'}
                  </T>
                  <Elakadtal forras="vallalkozas_adatlap" tema="vallalkozas_inditas" cim="Kérj visszahívást" style={{ paddingBottom: 0 }} />
                </View>
              ) : null}
            </>
          ) : lap === 2 ? (
            <>
              <Kerdes cim="Mivel foglalkozol majd?" kulcs="tevekenyseg" hiba={h.activities}>
                <Mezo felirat="Keresés" value={kereses} onChangeText={setKereses} placeholder="Például: fotózás, programozás" autoCorrect={false} returnKeyType="search" />
                {talalatok.length ? (
                  <View style={{ marginTop: 8, borderRadius: forma.mezo, borderWidth: 1, borderColor: szin.keret, overflow: 'hidden' }}>
                    {talalatok.map((t, i) => (
                      <Pressable key={t.key} accessibilityRole="button" accessibilityLabel={`${t.label}: hozzáadom`} onPress={() => tevHozzaad({ key: t.key, label: t.label, main: false })} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingVertical: 10, paddingHorizontal: 14, borderTopWidth: i ? 1 : 0, borderTopColor: szin.hajszal, backgroundColor: pressed ? '#F6F8FB' : '#fff' })}>
                        <T m={16.5} lh={1.35} style={{ flex: 1 }}>
                          {t.label}
                        </T>
                        <T m={14.5} s={650} c={szin.tintakekSzoveg} alahuz>
                          Hozzáadom
                        </T>
                      </Pressable>
                    ))}
                  </View>
                ) : kereses.trim().length >= 2 ? (
                  <T m={15} c={szin.halvany} lh={1.45} style={{ marginTop: 8 }}>
                    Erre nincs találat. Próbáld más szóval, vagy írd le lent a saját szavaiddal.
                  </T>
                ) : null}
                <GombSz cim="Megnézem a teljes listát" onPress={() => setTeljesLista(true)} />
              </Kerdes>
              {u.activities.length ? (
                <View>
                  <T m={16} s={650} style={{ marginBottom: 6 }}>
                    Ezeket választottad
                  </T>
                  {u.activities.map((t, i) => (
                    <View key={`${t.key ?? 'sajat'}-${i}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: szin.hajszal }}>
                      <Pressable
                        accessibilityRole="radio"
                        accessibilityState={{ checked: t.main }}
                        aria-checked={t.main}
                        accessibilityLabel={`${t.label}: fő tevékenység`}
                        onPress={() => al('activities')(u.activities.map((x, j) => ({ ...x, main: j === i })))}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1, minHeight: 44 }}
                      >
                        <View style={{ width: 22, height: 22, borderRadius: 11, borderWidth: t.main ? 7 : 1.5, borderColor: t.main ? szin.tintakek : szin.mezoKeret, backgroundColor: '#fff' }} />
                        <View style={{ flex: 1 }}>
                          <T m={16} s={600} lh={1.35}>
                            {t.label}
                          </T>
                          <T m={13.5} c={szin.halvany}>
                            {t.main ? 'Fő tevékenység' : 'Koppints, ha ez a fő'}
                          </T>
                        </View>
                      </Pressable>
                      <GombSz cim="Törlöm" m={14.5} onPress={() => al('activities')(((l) => (l.length && !l.some((x) => x.main) ? l.map((x, j) => ({ ...x, main: j === 0 })) : l))(u.activities.filter((_, j) => j !== i)))} />
                    </View>
                  ))}
                </View>
              ) : null}
              <Mezo felirat="Nem találod? Írd le a saját szavaiddal" value={u.activityFreeText} onChangeText={(t) => al('activityFreeText')(t.slice(0, 200))} multiline maxLength={200} sugo={ACTIVITY_NOT_FOUND_TEXT.replace(/^Nem találod\? Írd le a saját szavaiddal, mit csinálsz\. /, '')} />
              {fo || u.activityFreeText.trim() ? (
                <Tipp>
                  <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                    <Ikon3d nev="szamolo" pt={36} />
                    <View style={{ flex: 1 }}>
                      <T m={15.5} lh={1.5}>
                        {(r?.hints.costRatioText && r.answers.activities.find((x) => x.main)?.key === fo?.key ? r.hints.costRatioText : koltseghanyadSzoveg(fo, fn)) ?? `A költséghányadot ${fn} mondja meg.`}
                      </T>
                      <MiEz kulcs="koltseghanyad" forras="vallalkozas_adatlap" tema="vallalkozas_inditas" style={{ alignSelf: 'flex-start' }} />
                    </View>
                  </View>
                </Tipp>
              ) : null}
              {kepesites ? <Tipp sarga>{ACTIVITY_QUALIFICATION_NOTE}</Tipp> : null}
            </>
          ) : lap === 3 ? (
            <>
              <Tipp sarga>A székhely címe nyilvános lesz: bárki megnézheti a nyilvántartásban.</Tipp>
              <Kerdes cim="Hol lesz a vállalkozásod hivatalos címe?" kulcs="szekhely" hiba={h.seatKind}>
                <Valaszto
                  // „A lakcímem” csak meglévő lakcímmel választható (a „Rólad” lapról jön).
                  elemek={SEAT_KINDS.filter((k) => k !== 'lakcim' || !!lakcim || u.seatKind === 'lakcim').map((k) => ({ kulcs: k, cim: SEAT_KIND_LABELS[k], al: k === 'lakcim' ? (lakcim ?? 'Még nem adtad meg a lakcímedet.') : k === 'szekhelyszolgaltato' ? 'Ha nem szeretnéd, hogy az otthoni címed nyilvános legyen.' : undefined }))}
                  ertek={u.seatKind}
                  valt={al('seatKind')}
                />
              </Kerdes>
              {u.seatKind && u.seatKind !== 'lakcim' ? <CimMezok c={u.seat} al={al('seat')} h={h} elotag="seat" /> : null}
              {u.seatKind === 'mas_cim' ? (
                <Kerdes cim="Miért használhatod ezt a címet?" kulcs="szekhely_jogcim" hiba={h.seatRight}>
                  <Valaszto elemek={(['tulajdon', 'berlet', 'tulajdonos_hozzajarulasa'] as SeatRight[]).map((k) => ({ kulcs: k, cim: SEAT_RIGHT_LABELS[k] }))} ertek={u.seatRight} valt={al('seatRight')} />
                </Kerdes>
              ) : null}
              {u.seatKind === 'szekhelyszolgaltato' ? (
                <>
                  <Mezo felirat="A székhelyszolgáltató neve" value={u.providerName} onChangeText={(t) => al('providerName')(t.slice(0, 120))} hiba={h.providerName ?? h['seat.provider.name']} />
                  <View>
                    <Mezo felirat="A székhelyszolgáltató adószáma" value={u.providerAdoszam} onChangeText={(t) => al('providerAdoszam')(adoszamFormaz(t))} keyboardType="number-pad" placeholder="12345678-2-41" hiba={h.providerAdoszam ?? h['seat.provider.adoszam']} />
                    <HolTalalom kulcs="szekhely_jogcim" forras="vallalkozas_adatlap" tema="vallalkozas_inditas" />
                  </View>
                </>
              ) : null}
              <Kerdes cim="Lesz üzleted, irodád vagy műhelyed másik címen?" kulcs="telephely" hiba={h.vanTelephely}>
                <Valaszto
                  elemek={[
                    { kulcs: 'nincs' as const, cim: 'Nincs', al: 'Otthonról vagy az ügyfeleimnél dolgozom.' },
                    { kulcs: 'van' as const, cim: 'Van' },
                  ]}
                  ertek={u.vanTelephely}
                  valt={(v) => {
                    al('vanTelephely')(v);
                    if (v === 'van' && !u.otherSites.length) setU((x) => ({ ...x, vanTelephely: v, otherSites: [URES_CIM] }));
                  }}
                />
              </Kerdes>
              {u.vanTelephely === 'van'
                ? u.otherSites.map((c, i) => (
                    <View key={i} style={{ gap: 12 }}>
                      <T m={15} s={650}>
                        {i + 1}. másik cím
                      </T>
                      <CimMezok c={c} al={(uj) => al('otherSites')(u.otherSites.map((x, j) => (j === i ? uj : x)))} h={h} elotag={`otherSites.${i}`} />
                      {u.otherSites.length > 1 ? <GombSz cim="Ezt törlöm" m={14.5} onPress={() => al('otherSites')(u.otherSites.filter((_, j) => j !== i))} /> : null}
                    </View>
                  ))
                : null}
              {u.vanTelephely === 'van' && u.otherSites.length < 3 ? <GombM cim="Még egy cím" onPress={() => al('otherSites')([...u.otherSites, URES_CIM])} /> : null}
            </>
          ) : lap === 4 ? (
            <>
              <Kerdes cim="Mellette dolgozol máshol, tanulsz vagy nyugdíjas vagy?" kulcs="jogallas" hiba={h.workKind}>
                <Valaszto elemek={WORK_KINDS.map((k) => ({ kulcs: k, cim: WORK_KIND_LABELS[k] }))} ertek={u.workKind} valt={al('workKind')} />
              </Kerdes>
              {u.workKind ? <Tipp>{(r?.answers.workKind === u.workKind && !(kepesites && u.workKind === 'fofoglalkozas') ? r?.hints.contributionText : null) ?? jarulekSzoveg(u.workKind, kepesites) ?? ''}</Tipp> : null}
              <Kerdes cim="Dolgozol majd más EU-országbeli cégeknek, vagy veszel tőlük szolgáltatást (például online hirdetést)?" kulcs="kozossegi_adoszam" hiba={h.euPartner}>
                <Valaszto elemek={(['nem', 'igen', 'nem_tudom'] as EuPartnerAnswer[]).map((k) => ({ kulcs: k, cim: EU_LABELS[k] }))} ertek={u.euPartner} valt={al('euPartner')} />
              </Kerdes>
              <Kerdes cim="Lesz külön bankszámlád a vállalkozásnak? (nem kötelező)" kulcs="kulon_bankszamla">
                <Valaszto
                  elemek={[
                    { kulcs: 'igen' as const, cim: 'Igen' },
                    { kulcs: 'nem' as const, cim: 'Nem, a magánszámlámra jön', al: 'Ez nem baj.' },
                  ]}
                  ertek={u.kulonSzamla}
                  valt={al('kulonSzamla')}
                />
              </Kerdes>
            </>
          ) : (
            <>
              <Kerdes cim="Mikor szeretnél indulni?" kulcs="kezdes_napja" hiba={h.startPlan}>
                <Valaszto
                  elemek={[
                    { kulcs: 'mielobb' as const, cim: 'Minél előbb' },
                    { kulcs: 'datum' as const, cim: 'Egy adott napon', al: 'Csak emlékeztető: azon a napon küldd be.' },
                  ]}
                  ertek={u.startPlan}
                  valt={al('startPlan')}
                />
              </Kerdes>
              {u.startPlan === 'datum' ? <Mezo felirat="Melyik napon?" value={u.startDate} onChangeText={al('startDate')} placeholder="ÉÉÉÉ-HH-NN" keyboardType="numbers-and-punctuation" hiba={h.startDate} sugo={`Ma vagy legfeljebb fél évre előre: ${datumIg(napHozzaad(ma, 180))}. Év, hónap, nap.`} /> : null}
              <Tipp>{segitett ? `A vállalkozásod azon a napon indul, amikor ${fn} beküldi a bejelentést. Előre dátumot nem lehet megadni. Számlát csak ettől a naptól adhatsz.` : 'A vállalkozásod azon a napon indul, amikor beküldöd a bejelentést. Előre dátumot nem lehet megadni. Számlát csak ettől a naptól adhatsz.'}</Tipp>
              <Tipp>
                <View style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
                  <Ikon3d nev="szamolo" pt={36} />
                  <View style={{ flex: 1, gap: 6 }}>
                    <T m={15.5} lh={1.5}>
                      {fillPlaceholders(KERDOIV_TEXTS.afaLimitLine, { startText: kezdSzoveg, afaLimit: szam(afaHatar) })}
                    </T>
                    <T m={15.5} lh={1.5}>
                      {`Átalányadózóként idén legfeljebb ${szam(atalanyHatar)} Ft bevételed lehet (az évi határ időarányos része). Jövőre a teljes összeg.`}
                    </T>
                    <MiEz kulcs="alanyi_afa_mentesseg" forras="vallalkozas_adatlap" tema="vallalkozas_inditas" style={{ alignSelf: 'flex-start' }} />
                  </View>
                </View>
              </Tipp>
              <View>
                <T m={18} s={700} lh={1.3} style={{ marginBottom: 4 }} accessibilityRole="header">
                  Összefoglaló
                </T>
                {osszegzes.map((b, i) => (
                  <View key={`${b.cim}-${i}`} style={{ flexDirection: 'row', gap: 10, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: szin.hajszal, alignItems: 'flex-start' }}>
                    <View style={{ flex: 1 }}>
                      <T m={14} s={600} c={szin.halvany}>
                        {b.cim}
                      </T>
                      <T m={16} lh={1.45}>
                        {b.ertek}
                      </T>
                    </View>
                    <GombSz cim="Módosítom" m={14.5} onPress={() => setLap(b.n)} style={{ paddingVertical: 4 }} />
                  </View>
                ))}
              </View>
            </>
          )}
          <HibaSzoveg szoveg={hiba} />
          {h.adatok ? <GombM cim="Megadom az adataimat" ikon="fiok" onPress={adatokhoz} /> : null}
          {lap < 5 ? (
            <GombE cim="Tovább" onPress={() => void tovabb()} tolt={ment.isPending} disabled={!!stop && lap === 1} />
          ) : (
            <GombE cim={segitett ? (r && r.status !== 'kitoltes' ? 'Mentem' : KERDOIV_TEXTS.submitButtonSegitett) : r && r.status !== 'kitoltes' ? 'Mentem, vissza az útmutatóhoz' : KERDOIV_TEXTS.submitButton} onPress={() => void utmutatotKerek()} tolt={ment.isPending || bekuld.isPending} />
          )}
        </Lap>
        <Elakadtal forras="vallalkozas_adatlap" tema="vallalkozas_inditas" style={{ marginTop: 8, marginLeft: 4 }} />

        <AlsoLap lathato={teljesLista} bezar={() => setTeljesLista(false)}>
          <T m={21} s={700} lh={1.3} style={{ paddingRight: 80, marginBottom: 8 }}>
            Gyakori tevékenységek
          </T>
          {BUSINESS_ACTIVITIES.map((t, i) => (
            <Pressable
              key={t.key}
              accessibilityRole="button"
              onPress={() => {
                tevHozzaad({ key: t.key, label: t.label, main: false });
                setTeljesLista(false);
              }}
              style={({ pressed }) => ({ minHeight: 48, paddingVertical: 10, justifyContent: 'center', borderTopWidth: i ? 1 : 0, borderTopColor: szin.hajszal, backgroundColor: pressed ? '#F6F8FB' : 'transparent' })}
            >
              <T m={16.5} lh={1.35}>
                {t.label}
              </T>
            </Pressable>
          ))}
        </AlsoLap>
      </Kepernyo>
    </KeyboardAvoidingView>
  );
}

/** k5 #2: csak az „inditas” úton (különben vissza a bekötés Főoldalára). */
export default csakInditasUton(Adatlap);
