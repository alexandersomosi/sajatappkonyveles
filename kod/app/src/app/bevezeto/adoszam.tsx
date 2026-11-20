// SPEC §29.10.3 `adoszam` (+ §28.K.9 H, backend §29.4.4) – "Add meg az adószámodat". At the 8th digit we look the
// business up (debounce 250 ms, one call per törzsszám); "Ez a te vállalkozásod?" → the prefilled confirm screens, one per
// screen ("Rendben" / "Javítom"). "Most nem tudom" → the manual form, one question per screen. NAV not reachable (or no
// answer in 8 s on the server, 10 s here) → "Töltsd ki kézzel – ugyanúgy jó." with the digits kept. Never blocks onboarding.
import { useEffect, useRef, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import type { NavAddress, TaxpayerLookupResult } from '@/_shared/api';
import { BUSINESS_MANUAL_TEXTS as M, fillPlaceholders, TAXPAYER_LOOKUP_TEXTS as L } from '@/_shared/bekotes';
import type { YesNoDontKnow } from '@/_shared/enums';
import { GUIDED_TEXTS as G } from '@/_shared/k29g';
import { ApiHiba } from '@/api/http';
import { useAdoszamKereses, useGuided, useVallalkozasAdatok } from '@/api/hooks-k29g';
import { hibaUzenet } from '@/lib/hiba';
import { adoszamFormaz, adoszamHiba, iranyitoszamHiba } from '@/lib/validators';
import { BevezetoSav } from '@/kepernyok/Bevezeto';
import { Kapszulak, UrlapKerdes } from '@/kepernyok/Urlap';
import { forma, szin } from '@/theme/tokens';
import { Cimke, GombE, GombM, GombSz, HibaSzoveg, Lap } from '@/ui/alap';
import { Kepernyo } from '@/ui/keret';
import { Mezo } from '@/ui/Mezo';
import { T } from '@/ui/T';

type Lap = 'szam' | 'nev' | 'szekhely' | 'afa';
type Kereses = { allapot: 'nincs' } | { allapot: 'keres' } | { allapot: 'eredmeny'; r: TaxpayerLookupResult } | { allapot: 'hiba'; uzenet: string; kezzel: boolean };
const URES_CIM: NavAddress = { zip: '', city: '', streetName: '', streetType: '', houseNumber: '' };
/** "6720 Szeged, Kárász utca 7." – a Hungarian house number written with its period. */
const hazszam = (h: string) => (/^\d+$/.test(h.trim()) ? `${h.trim()}.` : h.trim());
const cimSzoveg = (a: NavAddress) => `${a.zip} ${a.city}, ${[a.streetName, a.streetType, a.houseNumber ? hazszam(a.houseNumber) : ''].filter(Boolean).join(' ')}${a.floor ? ` ${a.floor}. em.` : ''}${a.door ? ` ${a.door}.` : ''}`.trim();
/** The confirm screens ask (Rendben / Javítom), the manual ones too. */
const KERDES = { nev: 'Ez a vállalkozásod neve?', szekhely: 'Ez a székhelyed?', afa: 'Alanyi ÁFA-mentes vagy?' } as const;
const ALANYI: { kulcs: YesNoDontKnow; cim: string }[] = [
  { kulcs: 'igen', cim: M.alanyiYes },
  { kulcs: 'nem', cim: M.alanyiNo },
  { kulcs: 'nem_tudom', cim: M.alanyiDontKnow },
];

export default function BevezetoAdoszam() {
  const g = useGuided();
  const kereses = useAdoszamKereses();
  const ment = useVallalkozasAdatok();
  const fn = g.data?.welcome.accountant?.firstName ?? 'a könyvelőd';
  const [lap, setLap] = useState<Lap>('szam');
  /** 'nav' = the NAV answer is being confirmed; 'kezi' = typed by hand ("Most nem tudom" / NAV down / "Javítom"). */
  const [forras, setForras] = useState<'nav' | 'kezi'>('nav');
  const [szam, setSzam] = useState('');
  const [k, setK] = useState<Kereses>({ allapot: 'nincs' });
  const [nev, setNev] = useState('');
  const [cim, setCim] = useState<NavAddress>(URES_CIM);
  const [alanyi, setAlanyi] = useState<YesNoDontKnow | null>(null);
  const [javit, setJavit] = useState(false);
  const [hiba, setHiba] = useState<string | null>(null);
  const [mezoHiba, setMezoHiba] = useState<Record<string, string | null>>({});
  const utolso = useRef<string | null>(null);

  // the lookup at the 8th digit (debounce 250 ms, one call per distinct törzsszám)
  const torzs = szam.replace(/\D/g, '').slice(0, 8);
  useEffect(() => {
    if (torzs.length < 8 || torzs === utolso.current || forras === 'kezi') return;
    const t = setTimeout(async () => {
      utolso.current = torzs;
      setK({ allapot: 'keres' });
      try {
        const r = await Promise.race([
          kereses.mutateAsync(torzs),
          new Promise<never>((_, nem) => setTimeout(() => nem(new ApiHiba(504, 'lookup_unavailable', G.adoszamTimeout)), 10_000)),
        ]);
        if ((r as { status: string }).status === 'unavailable') setK({ allapot: 'hiba', uzenet: r.message ?? G.adoszamTimeout, kezzel: true });
        else setK({ allapot: 'eredmeny', r });
      } catch (e) {
        const kod = e instanceof ApiHiba ? e.code : '';
        if (kod === 'lookup_rate_limited') setK({ allapot: 'hiba', uzenet: L.rateLimited, kezzel: true });
        else if (kod === 'lookup_unavailable' || kod === 'lookup_not_configured' || !(e instanceof ApiHiba) || e.status >= 500) setK({ allapot: 'hiba', uzenet: G.adoszamTimeout, kezzel: true });
        else setK({ allapot: 'hiba', uzenet: hibaUzenet(e, G.adoszamTimeout), kezzel: true });
      }
    }, 250);
    return () => clearTimeout(t);
  }, [torzs, forras]); // eslint-disable-line react-hooks/exhaustive-deps

  const r = k.allapot === 'eredmeny' ? k.r : null;
  const tovabbUtan = () => router.replace({ pathname: '/bevezeto', params: { utan: 'adoszam' } });

  /** "Igen, ez az enyém" → the confirm screens with the NAV data. */
  const enyem = () => {
    if (!r) return;
    setSzam(r.adoszam ?? adoszamFormaz(szam));
    setNev(r.name ?? '');
    setCim(r.seat ?? URES_CIM);
    setAlanyi(r.alanyiMentes == null ? null : r.alanyiMentes ? 'igen' : 'nem');
    setForras('nav');
    setJavit(false);
    setLap('nev');
  };
  /** "Most nem tudom" / NAV down / not found → the manual form; full digits are kept. */
  const kezzel = () => {
    setForras('kezi');
    setJavit(true);
    setLap('nev');
  };

  async function bekuld() {
    setHiba(null);
    const teljes = !adoszamHiba(szam);
    try {
      await ment.mutateAsync({
        source: forras,
        adoszam: teljes ? adoszamFormaz(szam) : null,
        name: nev.trim(),
        seat: { ...cim, zip: cim.zip.trim(), city: cim.city.trim(), streetName: cim.streetName.trim(), streetType: cim.streetType.trim(), houseNumber: cim.houseNumber.trim() },
        alanyiMentes: alanyi ?? 'nem_tudom',
      });
      tovabbUtan();
    } catch (e) {
      if (e instanceof ApiHiba && e.fields) setMezoHiba(e.fields);
      setHiba(hibaUzenet(e, 'Nem sikerült menteni. Próbáld újra.'));
    }
  }

  const vissza = () => {
    setHiba(null);
    if (lap === 'afa') return setLap('szekhely');
    if (lap === 'szekhely') return setLap('nev');
    if (lap === 'nev') return setLap('szam');
    router.replace({ pathname: '/bevezeto', params: { vissza: 'adoszam' } });
  };
  const sav = (cimSzov: string, al?: string) => <BevezetoSav kulcs="adoszam" vissza={vissza} cim={cimSzov} szoveg={al} />;

  // ---------- 1. az adószám ----------
  if (lap === 'szam') {
    const szamHiba = szam.replace(/\D/g, '').length >= 11 ? adoszamHiba(szam) : null;
    return (
      <Kepernyo fejlec={sav(L.title, L.sub)} dokk={k.allapot === 'hiba' && k.kezzel ? <GombE cim={G.adoszamManual} onPress={kezzel} /> : r?.status === 'talalt' && r.selfEmployed !== false ? <GombE cim={L.cardYes} onPress={enyem} /> : undefined}>
        <Lap style={{ padding: 16 }}>
          <Mezo
            felirat={L.field}
            value={szam}
            onChangeText={(t) => {
              setSzam(adoszamFormaz(t));
              if (t.replace(/\D/g, '').slice(0, 8) !== utolso.current && k.allapot !== 'nincs') setK({ allapot: 'nincs' });
              if (forras === 'kezi') setForras('nav');
            }}
            keyboardType="number-pad"
            placeholder="12345678-1-23"
            maxLength={13}
            hol="adoszam"
            holForras="bevezeto"
            holTema="bekotes"
            hiba={szamHiba}
            accessibilityLabel={L.field}
          />
          {k.allapot === 'keres' ? (
            <T m={15} c={szin.halvany} style={{ marginTop: 10 }}>
              Keressük a NAV-nál…
            </T>
          ) : null}
          {r && r.status === 'talalt' && r.selfEmployed !== false ? (
            <View style={{ marginTop: 14, borderRadius: forma.mezo, borderWidth: 2, borderColor: szin.tintakek, padding: 14 }} accessibilityLiveRegion="polite">
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                <T m={17} s={700} lh={1.3} style={{ flexShrink: 1 }}>
                  {L.cardTitle}
                </T>
                {r.demo ? <Cimke szoveg={L.demo} /> : null}
              </View>
              <T m={16} s={600} lh={1.4} style={{ marginTop: 8 }}>
                {r.name}
              </T>
              {r.seat ? (
                <T m={15} lh={1.45} c={szin.halvany}>
                  {cimSzoveg(r.seat)}
                </T>
              ) : null}
              {r.adoszam ? (
                <T m={15} lh={1.45} c={szin.halvany} szam>
                  {r.adoszam}
                </T>
              ) : null}
              {r.afaWarning ? (
                <View style={{ marginTop: 10, borderRadius: 10, backgroundColor: szin.borostyanAlap, padding: 10 }}>
                  <T m={14.5} s={600} c={szin.borostyanSzoveg} lh={1.4}>
                    {L.notAlanyi}
                  </T>
                </View>
              ) : null}
              <GombSz cim={L.cardNo} onPress={() => { utolso.current = null; setSzam(''); setK({ allapot: 'nincs' }); }} style={{ marginTop: 4 }} />
            </View>
          ) : null}
          {r && (r.status === 'nincs' || r.status === 'nem_ev' || r.selfEmployed === false) ? (
            <View style={{ marginTop: 12 }} accessibilityLiveRegion="polite">
              <T m={15.5} s={600} lh={1.45} c={szin.veszely}>
                {r.status === 'nincs' ? L.notFound : L.notEv}
              </T>
              {r.status === 'nincs' ? <GombM cim={G.adoszamManual} onPress={kezzel} style={{ marginTop: 10 }} /> : null}
            </View>
          ) : null}
          {k.allapot === 'hiba' ? (
            <T m={15.5} s={600} lh={1.45} style={{ marginTop: 12 }} accessibilityLiveRegion="polite">
              {k.uzenet}
            </T>
          ) : null}
          {k.allapot !== 'hiba' ? <GombSz cim={L.dontKnow} m={16} onPress={kezzel} style={{ marginTop: 8 }} /> : null}
        </Lap>
      </Kepernyo>
    );
  }

  // ---------- 2–4. megerősítés (NAV-ból) vagy kézi kitöltés, egy kérdés egy képernyőn ----------
  const nav = forras === 'nav' && !javit;
  const rendben = (kov: Lap | 'kesz') => () => {
    setHiba(null);
    setJavit(forras === 'kezi');
    if (kov === 'kesz') void bekuld();
    else setLap(kov);
  };

  if (lap === 'nev') {
    const ok = () => {
      if (nev.trim().length < 2) return setMezoHiba({ name: 'Írd be a vállalkozásod nevét.' });
      setMezoHiba({});
      rendben('szekhely')();
    };
    return (
      <Kepernyo fejlec={sav(nav ? KERDES.nev : M.name)} dokk={<GombE cim={nav ? L.confirmOk : G.next} onPress={nav ? rendben('szekhely') : ok} />}>
        <Lap style={{ padding: 16 }}>
          {nav ? (
            <>
              <UrlapKerdes cim={nev} ikon="irat" />
              <GombM cim={L.confirmFix} onPress={() => setJavit(true)} />
            </>
          ) : (
            <Mezo felirat="A vállalkozás neve" sugo={fillPlaceholders(M.nameHint, { firstName: fn })} value={nev} onChangeText={setNev} autoCapitalize="words" hiba={mezoHiba.name} />
          )}
        </Lap>
      </Kepernyo>
    );
  }

  if (lap === 'szekhely') {
    const ok = () => {
      const e: Record<string, string | null> = {
        'seat.zip': iranyitoszamHiba(cim.zip),
        'seat.city': cim.city.trim() ? null : 'Írd be a települést.',
        'seat.streetName': cim.streetName.trim() ? null : 'Írd be a közterület nevét.',
        'seat.houseNumber': cim.houseNumber.trim() ? null : 'Írd be a házszámot.',
      };
      setMezoHiba(e);
      if (Object.values(e).some(Boolean)) return;
      rendben('afa')();
    };
    const al = (k: keyof NavAddress) => (v: string) => setCim((x) => ({ ...x, [k]: v }));
    return (
      <Kepernyo fejlec={sav(nav ? KERDES.szekhely : M.seat)} dokk={<GombE cim={nav ? L.confirmOk : G.next} onPress={nav ? rendben('afa') : ok} />}>
        <Lap style={{ padding: 16 }}>
          {nav ? (
            <>
              <UrlapKerdes cim={cimSzoveg(cim)} ikon="fooldal" />
              <GombM cim={L.confirmFix} onPress={() => setJavit(true)} />
            </>
          ) : (
            <View style={{ gap: 12 }}>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Mezo felirat="Irányítószám" value={cim.zip} onChangeText={al('zip')} keyboardType="number-pad" maxLength={4} style={{ width: 120 }} hiba={mezoHiba['seat.zip']} />
                <Mezo felirat="Település" value={cim.city} onChangeText={al('city')} style={{ flex: 1 }} hiba={mezoHiba['seat.city']} />
              </View>
              <Mezo felirat="Közterület neve" placeholder="például Petőfi Sándor" value={cim.streetName} onChangeText={al('streetName')} hiba={mezoHiba['seat.streetName']} />
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Mezo felirat="Jellege" placeholder="utca" value={cim.streetType} onChangeText={al('streetType')} style={{ flex: 1 }} />
                <Mezo felirat="Házszám" value={cim.houseNumber} onChangeText={al('houseNumber')} style={{ width: 120 }} hiba={mezoHiba['seat.houseNumber']} />
              </View>
            </View>
          )}
        </Lap>
      </Kepernyo>
    );
  }

  // afa
  return (
    <Kepernyo fejlec={sav(nav ? KERDES.afa : M.alanyi)} dokk={<GombE cim={L.confirmOk} tolt={ment.isPending} onPress={() => (alanyi ? rendben('kesz')() : setHiba('Válassz egyet.'))} />}>
      <Lap style={{ padding: 16 }}>
        {nav && alanyi ? (
          <>
            <UrlapKerdes cim={alanyi === 'igen' ? 'Igen, alanyi ÁFA-mentes vagy' : 'Nem alanyi ÁFA-mentes'} miert={alanyi === 'nem' ? L.notAlanyi : null} ikon="szamolo" />
            <GombM cim={L.confirmFix} onPress={() => setJavit(true)} />
          </>
        ) : (
          <Kapszulak elemek={ALANYI} ertek={alanyi} valt={setAlanyi} />
        )}
        <HibaSzoveg szoveg={hiba} />
      </Lap>
    </Kepernyo>
  );
}
