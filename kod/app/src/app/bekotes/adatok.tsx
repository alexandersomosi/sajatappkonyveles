// Kérdőív (FUNKCIOK 2): három rövid lap – Rólad · Vállalkozásod · Helyzeted. A tevékenységből javasolt költséghányad
// (2026: 45 / 80 / 90%, SPEC §7.1) csak javaslat: a könyvelő megerősíti.
import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, View, type ScrollViewInstance } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import type { ClientProfileInput } from '@/_shared/api';
import type { ActivityAnswer, TaxStatus } from '@/_shared/enums';
import { ApiHiba } from '@/api/http';
import { useOnboarding, useProfil, useProfilIndulo, useProfilMent, useProfilVazlat } from '@/api/hooks';
import { normalizeHuPhone } from '@/_shared/bekotes';
import { MiEz } from '@/ui/Magyarazat';
import { Elakadtal } from '@/ui/Visszahivas';
import { adoazonositoHiba, adoszamFormaz, adoszamHiba, datumHiba, datumNormal, iranyitoszamHiba, telefonHiba } from '@/lib/validators';
import { szin } from '@/theme/tokens';
import { GombE, GombSz, HibaSzoveg, Lap, Valaszto } from '@/ui/alap';
import { PATH_CHANGE_TEXTS } from '@/_shared/bekotes';
import { useUtvaltas } from '@/ui/Ut';
import { Ikon3d } from '@/ui/kepek';
import { CimSor, Kepernyo, vissza } from '@/ui/keret';
import { Mezo } from '@/ui/Mezo';
import { T } from '@/ui/T';
import { hibaUzenet } from '@/lib/hiba';
import { bekotesre, vezetettHref, vezetettKulcs } from '@/lib/vezetett';

type Urlap = {
  lastName: string; firstName: string; phone: string; adoazonositoJel: string; zip: string; city: string; line: string;
  adoszam: string; evNyilvantartasiSzam: string; hqMunicipality: string; activityText: string; activityAnswer: ActivityAnswer | null; evSince: string;
  taxStatus: TaxStatus | null; previousAccountant: string; hasSeparateBusinessAccount: 'igen' | 'nem' | null;
};
const URES: Urlap = {
  lastName: '', firstName: '', phone: '', adoazonositoJel: '', zip: '', city: '', line: '', adoszam: '', evNyilvantartasiSzam: '', hqMunicipality: '',
  activityText: '', activityAnswer: null, evSince: '', taxStatus: null, previousAccountant: '', hasSeparateBusinessAccount: null,
};
const LAPOK = ['Rólad', 'Vállalkozásod', 'Helyzeted'];
const ARANY: Record<ActivityAnswer, number> = { egyeb: 45, lista80: 80, kiskereskedelem: 90 };

export default function Adatok() {
  // utana: új vállalkozásnál a „Rólad” lap után hova menjünk tovább (a vállalkozás-központba vagy vissza az adatlap
  // adott lapjára) – így az indítás-úton senki nem tölti végig az adatlapot úgy, hogy a végén derül ki: ez hiányzik.
  const p = useLocalSearchParams<{ lap?: string; utana?: string; utanaLap?: string }>();
  const profil = useProfil();
  const ment = useProfilMent();
  const mentIndulo = useProfilIndulo();
  const o = useOnboarding();
  const utv = useUtvaltas();
  const fn = o.data?.accountant.firstName ?? 'A könyvelőd';
  /** mondat közepén: „Ebből tudja a könyvelőd” (még nincs kijelölt könyvelő) */
  const fnK = /^A könyvelőd/.test(fn) ? `a${fn.slice(1)}` : fn;
  // SPEC §26.1.2: ha most indítja a vállalkozását, csak a „Rólad” lap kell (a többit a bejelentésből töltjük).
  const indulo = o.data ? o.data.path === 'inditas' : !!p.utana;
  const vazlatMent = useProfilVazlat();
  // 11-19 javítás: „Mentem, tovább” → a lista SOROS lépése (journey.currentKey): ha a kérdőív már kész, az útmutató vagy
  // a Főoldal jön, nem újra a kérdőív 1. lapja.
  const mentesUtan = (cur?: string | null, ut?: string | null) =>
    // SPEC §29.10: in the guided run the server says what comes next
    vezetettKulcs()
      ? bekotesre()
      : p.utana === 'adatlap'
      ? router.replace({ pathname: '/bekotes/vallalkozas/adatlap', params: { lap: p.utanaLap ?? '1' } })
      : p.utana === 'vallalkozas'
        ? cur && ut && ['kerdoiv', 'bejelentes', 'ertesites', 'vegso_jovahagyas'].includes(cur)
          ? router.replace(ut as never)
          : router.replace('/bekotes')
        : router.replace({ pathname: '/bekotes/alkalmazottak', params: { csakKapu: '1' } });
  // Lapváltáskor a görgető a tetejére megy: a következő lap címe és első kérdése látsszon, ne a közepe.
  const gorgeto = useRef<ScrollViewInstance>(null);
  const lapra = (n: number) => {
    setLap(n);
    requestAnimationFrame(() => gorgeto.current?.scrollTo({ y: 0, animated: false }));
  };
  const lapDb = indulo ? 1 : 3;
  const [lap, setLap] = useState(Math.min(3, Math.max(1, Number(p.lap) || 1)));
  const [u, setU] = useState<Urlap>(URES);
  const [h, setH] = useState<Partial<Record<keyof Urlap, string | null>>>({});
  const [hiba, setHiba] = useState<string | null>(null);

  // 11-19 javító kör 2 (blokkoló): a profil minden „Tovább” (piszkozat) után újratöltődik. Régen ez minden mezőt
  // felülírt – a piszkozat az adószámot és a jogállást nem tárolja, így a beírt adószám '' lett, és az első „Mentés”
  // hamis „Ez az adószám nem stimmel” hibát adott. Most a szerver adata csak az ÜRES mezőket tölti ki: amit az ügyfél
  // ezen a képernyőn beírt vagy kiválasztott, azt soha nem írjuk felül (üressel/null-lal sem).
  const ures = (v: unknown) => v == null || v === '';
  const erintett = useRef(new Set<keyof Urlap>());
  useEffect(() => {
    const d = profil.data;
    if (!d) return;
    const szerver: Urlap = {
      lastName: d.lastName ?? '', firstName: d.firstName ?? '', phone: d.phone ?? '', adoazonositoJel: '', zip: d.address?.zip ?? '', city: d.address?.city ?? '', line: d.address?.line ?? '',
      adoszam: d.adoszam ?? '', evNyilvantartasiSzam: d.evNyilvantartasiSzam ?? '', hqMunicipality: d.hqMunicipality ?? '', activityText: d.activityText ?? '',
      activityAnswer: d.activityAnswer ?? null, evSince: d.evSince ?? '', taxStatus: d.taxStatus ?? null, previousAccountant: d.previousAccountant ?? '',
      hasSeparateBusinessAccount: d.hasSeparateBusinessAccount == null ? null : d.hasSeparateBusinessAccount ? 'igen' : 'nem',
    };
    setU((x) => {
      let valtozott = false;
      const y = { ...x } as Record<keyof Urlap, unknown>;
      for (const k of Object.keys(szerver) as (keyof Urlap)[]) {
        if (!erintett.current.has(k) && ures(x[k]) && !ures(szerver[k])) {
          y[k] = szerver[k];
          valtozott = true;
        }
      }
      return valtozott ? (y as Urlap) : x;
    });
  }, [profil.data]);

  // k7c2: "Folytatom" (no ?lap=) reopens the FIRST page that is not complete yet – the promise "később itt folytathatod"
  const ugrott = useRef(false);
  useEffect(() => {
    const d = profil.data;
    if (!d || ugrott.current || p.lap || indulo) return;
    ugrott.current = true;
    const van = (x: unknown) => !(x == null || x === '');
    const lap1 = van(d.lastName) && van(d.firstName) && van(d.phone) && Boolean(d.adoazonositoJelMasked) && van(d.address?.zip) && van(d.address?.city) && van(d.address?.line);
    const lap2 = (van(d.adoszam) || Boolean(d.adoszamPending)) && van(d.hqMunicipality) && van(d.activityText) && van(d.activityAnswer) && van(d.evSince);
    const lap3 = van(d.taxStatus) && d.hasSeparateBusinessAccount != null;
    if (o.data?.steps.find((x) => x.step === 'adatok')?.status === 'kesz' || (lap1 && lap2 && lap3)) return;
    const elso = !lap1 ? 1 : !lap2 ? 2 : 3;
    if (elso > 1) setLap(elso);
  }, [profil.data, p.lap, indulo, o.data]);

  // Javításkor a mező hibája azonnal eltűnik (nem csak a következő „Tovább”-nál).
  const al = <K extends keyof Urlap>(k: K) => (v: Urlap[K]) => {
    erintett.current.add(k);
    setU((x) => ({ ...x, [k]: v }));
    setH((x) => (x[k] ? { ...x, [k]: null } : x));
  };
  // Csak akkor „megadtad”, ha a szerveren tényleg van adóazonosító jel (a profil minden ügyfélnél létezik).
  const vanAdo = Boolean(profil.data?.adoazonositoJelMasked);
  const adatokKesz = o.data?.steps.find((x) => x.step === 'adatok')?.status === 'kesz';

  /**
   * 11-19 javítás (1. hiba): a „van” adatlap minden lapja „Tovább”-ra piszkozatként mentődik (és útváltás előtt is),
   * így semmi nem vész el, ha közben elmegy az adóigazolványért, vagy átvált „Még nincs, most indítanám”-ra. A szerver
   * csak az érvényes mezőket tárolja, az adószámot soha (azzal már nem válthatna), lépést nem változtat.
   */
  async function vazlat() {
    if (indulo || adatokKesz) return;
    const tel = normalizeHuPhone(u.phone);
    const ado = u.adoazonositoJel.replace(/\s/g, '');
    try {
      await vazlatMent.mutateAsync({
        ...(u.firstName.trim() ? { firstName: u.firstName.trim() } : {}),
        ...(u.lastName.trim() ? { lastName: u.lastName.trim() } : {}),
        ...(tel ? { phone: tel } : {}),
        ...(ado.length === 10 ? { adoazonositoJel: ado } : {}),
        ...(u.zip.trim() && u.city.trim() && u.line.trim() ? { address: { zip: u.zip.trim(), city: u.city.trim(), line: u.line.trim() } } : {}),
        ...(u.evNyilvantartasiSzam.trim() ? { evNyilvantartasiSzam: u.evNyilvantartasiSzam.trim() } : {}),
        ...(u.hqMunicipality.trim() ? { hqMunicipality: u.hqMunicipality.trim() } : {}),
        ...(u.activityText.trim() ? { activityText: u.activityText.trim() } : {}),
        ...(u.activityAnswer ? { activityAnswer: u.activityAnswer } : {}),
        ...(u.evSince.trim() && !datumHiba(u.evSince) ? { evSince: datumNormal(u.evSince) } : {}),
        ...(u.previousAccountant.trim() ? { previousAccountant: u.previousAccountant.trim() } : {}),
        ...(u.hasSeparateBusinessAccount ? { hasSeparateBusinessAccount: u.hasSeparateBusinessAccount === 'igen' } : {}),
      });
    } catch {
      /* a piszkozat nem akadályozza a továbblépést; a végső „Mentés” mindent ellenőriz */
    }
  }
  /** Útváltás az adatlapról: előbb mentjük, amit beírt (a lap ígérete: „… megmarad”). */
  const valtas = async () => {
    await vazlat();
    utv.modosit();
  };

  function ellenoriz(n: number): boolean {
    const e: Partial<Record<keyof Urlap, string | null>> = {};
    if (n === 1) {
      e.lastName = u.lastName.trim() ? null : 'Írd be a vezetékneved.';
      e.firstName = u.firstName.trim() ? null : 'Írd be a keresztneved.';
      // SPEC §27.4.4 S6: a telefon mindkét úton kötelező – a visszahívás a fő segítség.
      e.phone = normalizeHuPhone(u.phone) ? null : u.phone.trim() ? (telefonHiba(u.phone) ?? 'Magyar telefonszámot adj meg, például +36 30 123 4567.') : 'Add meg a telefonszámodat: ha elakadsz, ezen hívunk.';
      e.adoazonositoJel = vanAdo && !u.adoazonositoJel ? null : adoazonositoHiba(u.adoazonositoJel);
      e.zip = iranyitoszamHiba(u.zip);
      e.city = u.city.trim() ? null : 'Írd be a települést.';
      e.line = u.line.trim().length >= 3 ? null : 'Írd be az utcát és a házszámot.';
    } else if (n === 2) {
      // §28.K.9 "Most nem tudom": a könyvelő később tölti ki az adószámot – addig nem kötelező
      e.adoszam = profil.data?.adoszamPending && !u.adoszam.trim() ? null : adoszamHiba(u.adoszam);
      e.hqMunicipality = u.hqMunicipality.trim() ? null : 'Melyik településen van a székhelyed?';
      e.activityText = u.activityText.trim() ? null : 'Pár szóban: mivel foglalkozol?';
      e.activityAnswer = u.activityAnswer ? null : 'Válassz egyet.';
      e.evSince = datumHiba(u.evSince);
    } else {
      e.taxStatus = u.taxStatus ? null : 'Válassz egyet.';
      e.hasSeparateBusinessAccount = u.hasSeparateBusinessAccount ? null : 'Válassz egyet.';
    }
    setH(e);
    return !Object.values(e).some(Boolean);
  }

  async function tovabb() {
    if (!ellenoriz(lap)) return;
    if (indulo) {
      setHiba(null);
      try {
        await mentIndulo.mutateAsync({
          firstName: u.firstName.trim(), lastName: u.lastName.trim(), phone: normalizeHuPhone(u.phone) ?? u.phone.trim(),
          ...(u.adoazonositoJel ? { adoazonositoJel: u.adoazonositoJel.replace(/\s/g, '') } : {}),
          address: { zip: u.zip.trim(), city: u.city.trim(), line: u.line.trim() },
        });
        // Az adatlap a friss bekötési állapotból tudja, hogy a „Rólad” lap már megvan: megvárjuk, mielőtt odaviszünk.
        const friss = p.utana ? await o.refetch().catch(() => undefined) : undefined;
        const j = friss?.data?.journey;
        const cur = j?.steps.find((x) => x.key === j.currentKey);
        mentesUtan(j?.currentKey ?? null, cur?.action?.route ?? null);
      } catch (e) {
        if (e instanceof ApiHiba && e.fields) {
          const f = e.fields;
          setH({ lastName: f.lastName, firstName: f.firstName, phone: f.phone, adoazonositoJel: f.adoazonositoJel, zip: f['address.zip'], city: f['address.city'], line: f['address.line'] });
        }
        setHiba(hibaUzenet(e, 'Nem sikerült menteni. Próbáld újra.', { jelolt: ['lastName', 'firstName', 'phone', 'adoazonositoJel', 'address.zip', 'address.city', 'address.line'] }));
      }
      return;
    }
    if (lap < 3) {
      await vazlat();
      lapra(lap + 1);
      return;
    }
    const adat: ClientProfileInput = {
      firstName: u.firstName.trim(), lastName: u.lastName.trim(), phone: normalizeHuPhone(u.phone) ?? (u.phone.trim() || undefined), adoazonositoJel: u.adoazonositoJel.replace(/\s/g, ''),
      adoszam: u.adoszam.trim() ? adoszamFormaz(u.adoszam) : '', evNyilvantartasiSzam: u.evNyilvantartasiSzam.trim() || undefined,
      address: { zip: u.zip.trim(), city: u.city.trim(), line: u.line.trim() }, hqMunicipality: u.hqMunicipality.trim(), activityText: u.activityText.trim(),
      activityAnswer: u.activityAnswer as ActivityAnswer, taxStatus: u.taxStatus as TaxStatus, evSince: datumNormal(u.evSince), previousAccountant: u.previousAccountant.trim() || undefined,
      hasSeparateBusinessAccount: u.hasSeparateBusinessAccount === 'igen',
    };
    setHiba(null);
    try {
      await ment.mutateAsync(adat);
      // SPEC §28.K.7 + §28.3.4: a „van” út mentése után az alkalmazott/EFO kérdés, majd egyszer a kedvezmény-kapu
      router.replace(vezetettKulcs() ? vezetettHref('/bekotes/alkalmazottak', vezetettKulcs()!) : '/bekotes/alkalmazottak');
    } catch (e) {
      if (e instanceof ApiHiba && e.code === 'path_required') {
        setHiba(e.message);
        return;
      }
      if (e instanceof ApiHiba && e.fields) {
        const f = e.fields;
        const egy: Partial<Record<keyof Urlap, string | null>> = {
          lastName: f.lastName, firstName: f.firstName, phone: f.phone, adoazonositoJel: f.adoazonositoJel,
          zip: f['address.zip'], city: f['address.city'], line: f['address.line'],
          adoszam: f.adoszam, hqMunicipality: f.hqMunicipality, activityText: f.activityText, activityAnswer: f.activityAnswer, evSince: f.evSince,
          taxStatus: f.taxStatus, hasSeparateBusinessAccount: f.hasSeparateBusinessAccount,
        };
        setH(egy);
        if (egy.lastName || egy.firstName || egy.phone || egy.adoazonositoJel || egy.zip || egy.city || egy.line) lapra(1);
        else if (egy.adoszam || egy.hqMunicipality || egy.activityText || egy.activityAnswer || egy.evSince) lapra(2);
      }
      setHiba(hibaUzenet(e, 'Nem sikerült menteni. Próbáld újra.', { jelolt: ['lastName', 'firstName', 'phone', 'adoazonositoJel', 'address.zip', 'address.city', 'address.line', 'adoszam', 'hqMunicipality', 'activityText', 'activityAnswer', 'evSince', 'taxStatus', 'hasSeparateBusinessAccount'] }));
    }
  }

  // SPEC §27.2.2: a „van” űrlap soha nem nyílik a fő kérdés előtt (a szerver 409 path_required-del is elutasítja).
  if (o.data && o.data.path == null && !p.utana) {
    return (
      <Kepernyo ful="fooldal" fejlec={<CimSor visszaCim="Vissza a Főoldalra" vissza={() => vissza('/bekotes')} cim="Adataid" />}>
        <Lap style={{ padding: 18 }}>
          <T m={17} lh={1.5}>
            Előbb válaszolj a kérdésre: van már egyéni vállalkozásod? Utána megmutatjuk, milyen adatok kellenek.
          </T>
          <GombE cim="Válaszolok" onPress={() => router.replace('/bekotes')} style={{ marginTop: 14 }} />
        </Lap>
        <Elakadtal forras="adatok" tema="bekotes" style={{ marginTop: 8, marginLeft: 4 }} />
      </Kepernyo>
    );
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Kepernyo
        ful="fooldal"
        gorgetoRef={gorgeto}
        fejlec={
          <CimSor
            visszaCim={lap > 1 ? `Vissza: ${LAPOK[lap - 2]}` : 'Vissza a Főoldalra'}
            vissza={() => {
              if (lap > 1) return lapra(lap - 1);
              void vazlat();
              vissza('/bekotes');
            }}
            cim={indulo ? 'Adataid' : `Adataid – ${LAPOK[lap - 1]}`}
            al={indulo ? 'Csak pár adat rólad. A vállalkozásod adatait a bejelentés után a válaszaidból és az adószámodból töltjük ki.' : `${lap}. lap a 3-ból. ${lap === 1 ? 'Ezekkel az adatokkal jelentkezünk a NAV-nál.' : lap === 2 ? `Ebből tudja ${fnK}, mennyi költséget vehetsz le.` : 'Ettől függ, mennyi járulékot fizetsz.'}`}
          />
        }
      >
        {indulo && o.data?.path === 'inditas' ? <GombSz cim={PATH_CHANGE_TEXTS.roladLink} onPress={utv.modosit} style={{ marginTop: -6, marginBottom: 4, marginLeft: 4 }} /> : null}
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 12, paddingHorizontal: 4, display: lapDb > 1 ? 'flex' : 'none' }} accessibilityLabel={`${lap}. lap a 3-ból`}>
          {[1, 2, 3].map((i) => (
            <View key={i} style={{ flex: 1, height: 4, borderRadius: 2, backgroundColor: i <= lap ? szin.tintakek : szin.keret }} />
          ))}
        </View>
        <Lap style={{ padding: 18, gap: 14 }}>
          {lap === 1 ? (
            <>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Mezo felirat="Vezetéknév" value={u.lastName} onChangeText={al('lastName')} hiba={h.lastName} style={{ flex: 1 }} autoComplete="family-name" />
                <Mezo felirat="Keresztnév" value={u.firstName} onChangeText={al('firstName')} hiba={h.firstName} style={{ flex: 1 }} autoComplete="given-name" />
              </View>
              <Mezo felirat="Telefonszám" hol="telefonszam" holForras="adatok" value={u.phone} onChangeText={al('phone')} keyboardType="phone-pad" autoComplete="tel" placeholder="+36 20 123 4567" hiba={h.phone} />
              <Mezo
                felirat="Adóazonosító jel"
                hol="adoazonosito_jel"
                holForras="adatok"
                value={u.adoazonositoJel}
                onChangeText={(t) => al('adoazonositoJel')(t.replace(/\D/g, '').slice(0, 10))}
                keyboardType="number-pad"
                placeholder={vanAdo ? profil.data?.adoazonositoJelMasked : '10 számjegy'}
                sugo={vanAdo ? 'Már megadtad. Csak akkor írd be újra, ha javítanád.' : '10 számjegy, az adóigazolványodon találod.'}
                hiba={h.adoazonositoJel}
              />
              <View style={{ marginBottom: -7 }}>
                <T m={15} s={600}>
                  Lakcím
                </T>
                <MiEz kulcs="lakcim" cim="Hol találom?" forras="adatok" style={{ alignSelf: 'flex-start' }} />
              </View>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <Mezo felirat="Irányítószám" value={u.zip} onChangeText={(t) => al('zip')(t.replace(/\D/g, '').slice(0, 4))} keyboardType="number-pad" hiba={h.zip} style={{ width: 130 }} autoComplete="postal-code" />
                <Mezo felirat="Település" value={u.city} onChangeText={al('city')} hiba={h.city} style={{ flex: 1 }} />
              </View>
              <Mezo felirat="Utca, házszám" value={u.line} onChangeText={al('line')} hiba={h.line} autoComplete="street-address" />
            </>
          ) : lap === 2 ? (
            <>
              <View>
                <Mezo felirat="Adószám" hol="adoszam" holForras="adatok" value={u.adoszam} onChangeText={(t) => al('adoszam')(adoszamFormaz(t))} keyboardType="number-pad" placeholder="12345678-1-23" hiba={h.adoszam} />
                <GombSz cim={PATH_CHANGE_TEXTS.adoszamNincsLink} m={15} onPress={() => void valtas()} style={{ paddingTop: 4, paddingBottom: 0 }} />
              </View>
              <Mezo felirat="EV nyilvántartási szám (ha tudod)" hol="ev_nyilvantartasi_szam" holForras="adatok" value={u.evNyilvantartasiSzam} onChangeText={(t) => al('evNyilvantartasiSzam')(t.replace(/\D/g, '').slice(0, 8))} keyboardType="number-pad" sugo={`Ha nem tudod, ${fnK} kikeresi.`} />
              <Mezo felirat="Székhelyed települése" value={u.hqMunicipality} onChangeText={al('hqMunicipality')} hiba={h.hqMunicipality} sugo="Az iparűzési adó ide megy." />
              <Mezo felirat="Mivel foglalkozol?" hol="tevekenyseg" holForras="adatok" value={u.activityText} onChangeText={al('activityText')} placeholder="Például: grafikai tervezés" hiba={h.activityText} />
              <View>
                <T m={15} s={600} style={{ marginBottom: 7 }}>
                  Melyik illik rád leginkább?
                </T>
                <Valaszto
                  elemek={[
                    { kulcs: 'egyeb' as const, cim: 'Szolgáltatás, szellemi munka', al: 'Például grafikus, programozó, tanácsadó, oktató.' },
                    { kulcs: 'lista80' as const, cim: 'Kétkezi munka a törvényi listáról', al: 'Például fodrász, kozmetikus, fényképész, autószerelő, építőipar, vendéglátás, taxi.' },
                    { kulcs: 'kiskereskedelem' as const, cim: 'Csak kiskereskedelem', al: 'Boltban vagy webshopban árut adsz el magánszemélyeknek.' },
                  ]}
                  ertek={u.activityAnswer}
                  valt={al('activityAnswer')}
                />
                {h.activityAnswer ? (
                  <T m={14} s={500} c={szin.veszely} style={{ marginTop: 6 }}>
                    {h.activityAnswer}
                  </T>
                ) : null}
                {u.activityAnswer ? (
                  <View style={{ marginTop: 10, borderRadius: 12, backgroundColor: szin.nyomott, padding: 12 }}>
                    <MiEz kulcs="koltseghanyad" forras="adatok" style={{ alignSelf: 'flex-start', marginBottom: 2 }} />
                    <T m={15} lh={1.45}>
                      Ez alapján a bevételed <T m={15} s={650}>{ARANY[u.activityAnswer]}%-át</T> veszi költségnek a NAV (2026-os szabály). {fn} a tevékenységed kódja alapján megerősíti.
                    </T>
                  </View>
                ) : null}
              </View>
              <Mezo felirat="Mióta vagy egyéni vállalkozó?" hol="vallalkozo_miota" holForras="adatok" value={u.evSince} onChangeText={al('evSince')} placeholder="ÉÉÉÉ-HH-NN" keyboardType="numbers-and-punctuation" hiba={h.evSince} sugo="Év, hónap, nap. Ha nem tudod pontosan, a hónap elseje is jó." />
            </>
          ) : (
            <>
              <View>
                <T m={15} s={600}>
                  Mellette dolgozol máshol is?
                </T>
                <MiEz kulcs="jogallas" forras="adatok" style={{ alignSelf: 'flex-start', marginBottom: 4 }} />
                <Valaszto
                  elemek={[
                    { kulcs: 'fofoglalkozasu' as const, cim: 'Nem, ez a fő munkám', al: 'Főállású egyéni vállalkozó vagy.' },
                    { kulcs: 'mellekallasu' as const, cim: 'Igen, mellékállásban csinálom', al: 'Mellette legalább heti 36 órás munkahelyed van, vagy nappali tagozaton tanulsz.' },
                    { kulcs: 'nyugdijas' as const, cim: 'Nyugdíjas vagyok', al: 'Saját jogú nyugdíj mellett vállalkozol.' },
                  ]}
                  ertek={u.taxStatus}
                  valt={al('taxStatus')}
                />
                {h.taxStatus ? (
                  <T m={14} s={500} c={szin.veszely} style={{ marginTop: 6 }}>
                    {h.taxStatus}
                  </T>
                ) : null}
              </View>
              <View>
                <T m={15} s={600}>
                  Van külön bankszámlád a vállalkozásnak?
                </T>
                <MiEz kulcs="kulon_bankszamla" forras="adatok" style={{ alignSelf: 'flex-start', marginBottom: 4 }} />
                <Valaszto
                  elemek={[
                    { kulcs: 'igen' as const, cim: 'Igen, van' },
                    { kulcs: 'nem' as const, cim: 'Nincs, a magánszámlámra jön', al: 'Ez nem baj, csak szólunk, melyik kivonatot kérjük.' },
                  ]}
                  ertek={u.hasSeparateBusinessAccount}
                  valt={al('hasSeparateBusinessAccount')}
                />
                {h.hasSeparateBusinessAccount ? (
                  <T m={14} s={500} c={szin.veszely} style={{ marginTop: 6 }}>
                    {h.hasSeparateBusinessAccount}
                  </T>
                ) : null}
              </View>
              <Mezo felirat="Eddigi könyvelőd (ha volt)" hol="elozo_konyvelo" holForras="adatok" value={u.previousAccountant} onChangeText={al('previousAccountant')} sugo={`${fn} felveszi vele a kapcsolatot az idei adatokért.`} />
              <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start', borderRadius: 12, backgroundColor: szin.nyomott, padding: 12 }}>
                <Ikon3d nev="kerdezek" pt={36} />
                <View style={{ flex: 1 }}>
                  <T m={15.5} s={650} lh={1.4}>
                    Könyvelőt váltasz?
                  </T>
                  <T m={14.5} lh={1.45} c={szin.halvany} style={{ marginTop: 2 }}>
                    Megmondjuk, mi lesz az idei bevallásokkal és a régi meghatalmazással.
                  </T>
                  <MiEz kulcs="konyvelovaltas" forras="adatok" style={{ alignSelf: 'flex-start' }} />
                </View>
              </View>
            </>
          )}
          <HibaSzoveg szoveg={hiba} />
          <GombE cim={lap < lapDb ? 'Tovább' : indulo && p.utana ? 'Mentem, tovább' : 'Mentés'} onPress={tovabb} tolt={ment.isPending || mentIndulo.isPending || vazlatMent.isPending} style={{ marginTop: 4 }} />
          {!indulo && !adatokKesz && lap < 3 ? (
            <T m={14} lh={1.4} c={szin.halvany} kozep style={{ marginTop: -2 }}>
              Amit beírtál, elmentjük: később itt folytathatod.
            </T>
          ) : null}
        </Lap>
        <Elakadtal forras="adatok" tema="bekotes" style={{ marginTop: 8, marginLeft: 4 }} />
      </Kepernyo>
    </KeyboardAvoidingView>
  );
}
