// SPEC §29.5 F1 – „Igazolást kérek”: egy kérdés egy képernyőn. Típus → (év) → mire kell → ki kéri → (bővített /
// hivatalos) → meddig kell → (papíron, angolul) → összegzés a díj-sorral → „Elküldöm”. A többit (adóazonosító jel,
// lakcím) a profilból vesszük. ?tipus=<típus> = a típus már ki van választva (Főoldal, régi kérés-kártyák).
import { useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import {
  CERT_FORM_TEXTS,
  CERT_PURPOSE_KINDS,
  CERT_PURPOSE_LABELS,
  CERT_RULES,
  CERT_SZECHENYI_USER,
  CERT_TYPE_TEXTS,
  CERT_VALIDATION,
  CERTIFICATE_TYPES_K29,
  LEGACY_CERTIFICATE_TYPE_MAP,
  type CertExtendedAnswer,
  type CertificateTypeK29,
  type CertOfficialAnswer,
  type CertPurposeKind,
} from '@/_shared/k29f';
import { fillPlaceholders } from '@/_shared/bekotes';
import { useIgazolasKuld, useIgazolasUrlap } from '@/api/k29f';
import { datumEvvel, maiNap, napHozzaad, napKulonbseg, szam } from '@/lib/format';
import { hibaUzenet } from '@/lib/hiba';
import { Kapszulak, UrlapFej, UrlapKerdes } from '@/kepernyok/Urlap';
import { szin } from '@/theme/tokens';
import { GombE, GombSz, HibaSzoveg, Kapcsolo, Lap, Sor } from '@/ui/alap';
import { Mezo } from '@/ui/Mezo';
import { Betolt, Hiba, Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { T } from '@/ui/T';
import { ZaroltKapu } from '@/ui/Zarolt';
import { ZarolasKapu } from '@/ui/ZarolasKapu';

type LapKulcs = 'tipus' | 'ev' | 'cel' | 'felhasznalo' | 'bovitett' | 'forma' | 'leiras' | 'hatarido' | 'papir' | 'osszegzes';

function lapokOf(t: CertificateTypeK29 | null, fix: boolean): LapKulcs[] {
  const eleje: LapKulcs[] = fix ? [] : ['tipus'];
  switch (t) {
    case 'jovedelemigazolas':
      return [...eleje, 'ev', 'cel', 'felhasznalo', 'hatarido', 'papir', 'osszegzes'];
    case 'adoigazolas':
      return [...eleje, 'cel', 'felhasznalo', 'bovitett', 'hatarido', 'papir', 'osszegzes'];
    case 'koma':
      return [...eleje, 'cel', 'felhasznalo', 'hatarido', 'osszegzes'];
    case 'ev_kivonat':
      return [...eleje, 'cel', 'forma', 'hatarido', 'osszegzes'];
    case 'egyeb':
      return [...eleje, 'leiras', 'hatarido', 'osszegzes'];
    default:
      return ['tipus'];
  }
}

/** ÉÉÉÉ-HH-NN szövegből, vagy null (a „Meddig kell?” mező). */
function napBol(s: string): string | null {
  const t = s.trim();
  if (!t) return null;
  const m = /^(\d{4})[.\-/ ]+(\d{1,2})[.\-/ ]+(\d{1,2})\.?$/.exec(t);
  if (!m) return 'hibas';
  return `${m[1]}-${m[2]!.padStart(2, '0')}-${m[3]!.padStart(2, '0')}`;
}

function UjIgazolasTartalom() {
  const p = useLocalSearchParams<{ tipus?: string; lap?: string }>();
  const fixTipus = p.tipus ? (LEGACY_CERTIFICATE_TYPE_MAP[p.tipus] ?? null) : null;
  const urlap = useIgazolasUrlap();
  const kuld = useIgazolasKuld();
  const jelez = useJelzes();
  const fn = urlap.data?.firstName ?? 'A könyvelőd';
  const [tipus, setTipus] = useState<CertificateTypeK29 | null>(fixTipus);
  const [ev, setEv] = useState<number | null>(null);
  const [cel, setCel] = useState<CertPurposeKind | null>(null);
  const [celSzoveg, setCelSzoveg] = useState('');
  const [felhasznalo, setFelhasznalo] = useState('');
  const [bovitett, setBovitett] = useState<CertExtendedAnswer | null>(null);
  const [forma, setForma] = useState<CertOfficialAnswer | null>(null);
  const [leiras, setLeiras] = useState('');
  const [hatarido, setHatarido] = useState('');
  const [papir, setPapir] = useState(false);
  const [papirFelhasznalonak, setPapirFelhasznalonak] = useState(false);
  const [papirCim, setPapirCim] = useState('');
  const [angol, setAngol] = useState(false);
  const [angolMi, setAngolMi] = useState(false);
  const [hiba, setHiba] = useState<string | null>(null);

  const lapok = useMemo(() => lapokOf(tipus, Boolean(fixTipus)), [tipus, fixTipus]);
  const i = Math.max(0, Math.min(lapok.length - 1, Number(p.lap ?? 0) || 0));
  const lap = lapok[i]!;
  const ugrik = (n: number) => {
    setHiba(null);
    router.setParams({ lap: String(n) });
  };
  const dij = tipus ? (urlap.data?.fees[tipus] ?? 0) : 0;
  const nap = napBol(hatarido);
  const ma = maiNap();
  const kozel = nap && nap !== 'hibas' && napKulonbseg(ma, nap) < CERT_RULES.warnDays;

  if (urlap.isLoading) return <Kepernyo fejlec={<UrlapFej vissza={() => vissza('/igazolas')} szakasz={CERT_FORM_TEXTS.newButton} />}><Betolt /></Kepernyo>;
  if (urlap.error) return <Kepernyo fejlec={<UrlapFej vissza={() => vissza('/igazolas')} szakasz={CERT_FORM_TEXTS.newButton} />}><Hiba hiba={urlap.error} ujra={() => void urlap.refetch()} /></Kepernyo>;

  const ellenoriz = (): string | null => {
    switch (lap) {
      case 'tipus':
        return tipus ? null : CERT_VALIDATION.type;
      case 'ev': {
        if (!ev) return CERT_VALIDATION.year;
        const y = urlap.data?.years.find((x) => x.year === ev);
        return y && !y.ok ? (y.reason ?? CERT_VALIDATION.yearCurrent) : null;
      }
      case 'cel':
        if (!cel) return CERT_VALIDATION.purpose;
        return cel === 'mas' && !celSzoveg.trim() ? CERT_VALIDATION.purposeText : null;
      case 'felhasznalo':
        return (tipus === 'jovedelemigazolas' || tipus === 'adoigazolas') && !felhasznalo.trim() ? CERT_VALIDATION.userName : null;
      case 'bovitett':
        return bovitett ? null : CERT_VALIDATION.extended;
      case 'forma':
        return forma ? null : CERT_VALIDATION.official;
      case 'leiras':
        return leiras.trim().length < 3 ? CERT_VALIDATION.otherText : null;
      case 'hatarido':
        if (nap === 'hibas') return 'ÉÉÉÉ-HH-NN alakban (például 2026-12-15).';
        if (nap && nap < ma) return CERT_VALIDATION.neededByPast;
        if (nap && nap > napHozzaad(ma, CERT_RULES.neededByMaxDays)) return CERT_VALIDATION.neededByFar;
        return null;
      case 'papir':
        return papir && papirFelhasznalonak && papirCim.trim().length < 5 ? CERT_VALIDATION.paperAddress : null;
      default:
        return null;
    }
  };

  const kuldes = async () => {
    if (!tipus || !cel) return;
    try {
      const v = await kuld.mutateAsync({
        type: tipus,
        ...(tipus === 'jovedelemigazolas' && ev ? { year: ev } : {}),
        purposeKind: cel,
        ...(cel === 'mas' ? { purposeText: celSzoveg.trim() } : {}),
        ...(felhasznalo.trim() ? { userName: felhasznalo.trim() } : {}),
        neededBy: nap && nap !== 'hibas' ? nap : null,
        paperCopy: papir,
        ...(papir ? { paperTo: papirFelhasznalonak ? 'felhasznalo' : 'lakcim' } : {}),
        ...(papir && papirFelhasznalonak ? { paperAddress: papirCim.trim() } : {}),
        ...(tipus === 'adoigazolas' && bovitett ? { extended: bovitett } : {}),
        ...(tipus === 'ev_kivonat' && forma ? { official: forma } : {}),
        englishRequested: angol,
        ...(tipus === 'egyeb' ? { otherText: leiras.trim() } : {}),
      });
      if (v.canPay) {
        jelez({ szoveg: 'Elküldted. Fizesd ki a díjat, és ' + fn + ' nekilát.', kesz: true });
        return router.replace('/fiok/dijak');
      }
      jelez({ szoveg: fillPlaceholders(CERT_FORM_TEXTS.sentToast, { firstName: fn }), kesz: true });
      router.replace(`/igazolas/${v.id}`);
    } catch (e) {
      setHiba(hibaUzenet(e, 'Nem ment el. Próbáld újra.'));
    }
  };
  const tovabb = () => {
    const h = ellenoriz();
    if (h) return setHiba(h);
    if (lap === 'osszegzes') return void kuldes();
    ugrik(i + 1);
  };

  const sor = (cim: string, ertek: string | null) =>
    ertek ? (
      <View key={cim} style={{ flexDirection: 'row', gap: 12, paddingVertical: 6 }}>
        <T m={15} c={szin.halvany} style={{ width: 112 }}>
          {cim}
        </T>
        <T m={15.5} s={550} lh={1.4} style={{ flex: 1 }}>
          {ertek}
        </T>
      </View>
    ) : null;
  const n = fixTipus ? lapok.length : lapok.length - 1;
  const szamlalo = lap === 'tipus' ? {} : { i: fixTipus ? i + 1 : i, n };

  return (
    <Kepernyo
      fejlec={<UrlapFej vissza={() => (i > 0 ? ugrik(i - 1) : vissza('/igazolas'))} szakasz={CERT_FORM_TEXTS.newButton} />}
      dokk={lap === 'tipus' ? undefined : <GombE cim={lap === 'osszegzes' ? CERT_FORM_TEXTS.send : CERT_FORM_TEXTS.next} tolt={kuld.isPending} onPress={tovabb} />}
    >
      {urlap.data?.locked ? (
        <Lap style={{ padding: 16 }} elso>
          <T m={16} s={600} lh={1.45} c={szin.borostyanSzoveg}>
            {urlap.data.locked}
          </T>
        </Lap>
      ) : null}
      {lap === 'tipus' ? (
        <>
          <UrlapKerdes cim={CERT_FORM_TEXTS.typeTitle} miert={fillPlaceholders(CERT_FORM_TEXTS.typeSub, { firstName: fn })} />
          <Lap>
            {CERTIFICATE_TYPES_K29.map((t, k) => (
              <Sor
                key={t}
                elso={k === 0}
                ikon="igazolas"
                cim={CERT_TYPE_TEXTS[t].label}
                al={CERT_TYPE_TEXTS[t].line}
                onPress={() => {
                  setTipus(t);
                  setHiba(null);
                  router.setParams({ lap: '1' });
                }}
              />
            ))}
          </Lap>
        </>
      ) : lap === 'ev' ? (
        <>
          <UrlapKerdes {...szamlalo} cim={CERT_FORM_TEXTS.yearTitle} miert={CERT_FORM_TEXTS.yearSub} />
          <Kapszulak
            elemek={(urlap.data?.years ?? []).map((y) => ({ kulcs: String(y.year), cim: String(y.year) }))}
            ertek={ev ? String(ev) : null}
            valt={(k) => {
              setEv(Number(k));
              setHiba(null);
            }}
          />
          {ev && urlap.data?.years.find((y) => y.year === ev && !y.ok) ? (
            <Lap style={{ padding: 16, marginTop: 12 }}>
              <T m={15.5} lh={1.45}>
                {urlap.data.years.find((y) => y.year === ev)!.reason}
              </T>
              {ev === Number(ma.slice(0, 4)) ? <GombSz cim={CERT_FORM_TEXTS.yearToStatement} onPress={() => router.push('/kimutatas')} style={{ marginTop: 6 }} /> : null}
            </Lap>
          ) : null}
        </>
      ) : lap === 'cel' ? (
        <>
          <UrlapKerdes {...szamlalo} cim={CERT_FORM_TEXTS.purposeTitle} />
          <Kapszulak
            elemek={CERT_PURPOSE_KINDS.map((k) => ({ kulcs: k, cim: CERT_PURPOSE_LABELS[k] }))}
            ertek={cel}
            valt={(k) => {
              setCel(k);
              if (k === 'szechenyi' && !felhasznalo.trim()) setFelhasznalo(CERT_SZECHENYI_USER);
              setHiba(null);
            }}
          />
          {cel === 'mas' ? <Mezo felirat={CERT_FORM_TEXTS.purposeOther} value={celSzoveg} onChangeText={setCelSzoveg} maxLength={CERT_RULES.purposeTextMax} style={{ marginTop: 14 }} /> : null}
        </>
      ) : lap === 'felhasznalo' ? (
        <>
          <UrlapKerdes {...szamlalo} cim={tipus === 'koma' ? CERT_FORM_TEXTS.userOptional : CERT_FORM_TEXTS.userTitle} miert={CERT_FORM_TEXTS.userHint} />
          <Mezo felirat="Szervezet neve" value={felhasznalo} onChangeText={setFelhasznalo} maxLength={CERT_RULES.userNameMax} placeholder="Például OTP Bank" />
        </>
      ) : lap === 'bovitett' ? (
        <>
          <UrlapKerdes {...szamlalo} cim={CERT_FORM_TEXTS.extendedTitle} />
          <Kapszulak elemek={(['igen', 'nem', 'nem_tudom'] as const).map((k) => ({ kulcs: k, cim: CERT_FORM_TEXTS.extended[k] }))} ertek={bovitett} valt={setBovitett} />
        </>
      ) : lap === 'forma' ? (
        <>
          <UrlapKerdes {...szamlalo} cim={CERT_FORM_TEXTS.officialTitle} miert={CERT_FORM_TEXTS.officialHint} />
          <Kapszulak elemek={(['hivatalos', 'kivonat'] as const).map((k) => ({ kulcs: k, cim: CERT_FORM_TEXTS.official[k] }))} ertek={forma} valt={setForma} oszlop />
        </>
      ) : lap === 'leiras' ? (
        <>
          <UrlapKerdes {...szamlalo} cim={CERT_FORM_TEXTS.otherTitle} miert={CERT_FORM_TEXTS.otherHint} />
          <Mezo felirat="Leírás" value={leiras} onChangeText={setLeiras} multiline maxLength={CERT_RULES.otherTextMax} />
        </>
      ) : lap === 'hatarido' ? (
        <>
          <UrlapKerdes {...szamlalo} cim={CERT_FORM_TEXTS.neededByTitle} miert="Ha egy adott napig kell, írd be (például 2026-12-15). Ha nem sürgős, hagyd üresen." />
          <Mezo felirat="Dátum" value={hatarido} onChangeText={setHatarido} placeholder={napHozzaad(ma, 14)} keyboardType="numbers-and-punctuation" />
          {kozel ? (
            <T m={15} lh={1.45} c={szin.borostyanSzoveg} style={{ marginTop: 10 }}>
              {CERT_FORM_TEXTS.neededByWarn}
            </T>
          ) : null}
        </>
      ) : lap === 'papir' ? (
        <>
          <UrlapKerdes {...szamlalo} cim={CERT_FORM_TEXTS.paperTitle} miert="Az elektronikus igazolást itt, az appban kapod meg. Papíron csak akkor kérd, ha valaki ragaszkodik hozzá." />
          <Lap style={{ marginHorizontal: -16 }}>
            <Kapcsolo be={papir} valt={setPapir} cim={CERT_FORM_TEXTS.paperOn} />
            {papir ? <Kapcsolo be={papirFelhasznalonak} valt={setPapirFelhasznalonak} cim={CERT_FORM_TEXTS.paperToUser} /> : null}
          </Lap>
          {papir && papirFelhasznalonak ? <Mezo felirat={CERT_FORM_TEXTS.paperToUserAddress} value={papirCim} onChangeText={setPapirCim} maxLength={CERT_RULES.paperAddressMax} style={{ marginTop: 12 }} /> : null}
          <Lap style={{ marginHorizontal: -16, marginTop: 12 }}>
            <Kapcsolo be={angol} valt={setAngol} cim={CERT_FORM_TEXTS.englishTitle} />
          </Lap>
          <Pressable accessibilityRole="button" onPress={() => setAngolMi((x) => !x)} style={{ paddingVertical: 8 }}>
            <T m={15} s={600} c={szin.tintakekSzoveg}>
              {CERT_FORM_TEXTS.englishWhat}
            </T>
          </Pressable>
          {angolMi || angol ? (
            <T m={15} lh={1.45} c={szin.halvany}>
              {CERT_FORM_TEXTS.englishText}
            </T>
          ) : null}
        </>
      ) : (
        <>
          <UrlapKerdes {...szamlalo} cim={CERT_FORM_TEXTS.summaryTitle} miert={`${fn} ezekkel az adatokkal kéri a NAV-tól. Ha valami nem stimmel, lépj vissza.`} />
          <Lap style={{ paddingHorizontal: 16, paddingBottom: 10 }}>
            {[
              sor(CERT_FORM_TEXTS.summaryRows.type, tipus ? CERT_TYPE_TEXTS[tipus].label : null),
              sor(CERT_FORM_TEXTS.summaryRows.year, ev && tipus === 'jovedelemigazolas' ? String(ev) : null),
              sor(CERT_FORM_TEXTS.summaryRows.purpose, cel ? (cel === 'mas' ? celSzoveg.trim() : CERT_PURPOSE_LABELS[cel]) : null),
              sor(CERT_FORM_TEXTS.summaryRows.user, felhasznalo.trim() || null),
              sor(CERT_FORM_TEXTS.summaryRows.extended, tipus === 'adoigazolas' && bovitett ? CERT_FORM_TEXTS.extended[bovitett] : null),
              sor(CERT_FORM_TEXTS.summaryRows.official, tipus === 'ev_kivonat' && forma ? CERT_FORM_TEXTS.official[forma] : null),
              sor(CERT_FORM_TEXTS.summaryRows.other, tipus === 'egyeb' ? leiras.trim() : null),
              sor(CERT_FORM_TEXTS.summaryRows.neededBy, nap && nap !== 'hibas' ? datumEvvel(nap) : null),
              sor(CERT_FORM_TEXTS.summaryRows.paper, papir ? (papirFelhasznalonak ? papirCim.trim() : 'A lakcímedre') : null),
              sor(CERT_FORM_TEXTS.summaryRows.english, angol ? 'Igen – hiteles fordítást külön kérj' : null),
            ]}
          </Lap>
          <T m={16} s={650} lh={1.45} style={{ marginTop: 12 }} szam>
            {dij > 0 ? fillPlaceholders(CERT_FORM_TEXTS.feePaid, { osszeg: szam(dij) }) : CERT_FORM_TEXTS.feeFree}
          </T>
        </>
      )}
      <HibaSzoveg szoveg={hiba} />
    </Kepernyo>
  );
}

/** SPEC §26.5.2 + §28.K.5: a bekötés alatt és zárolás alatt az igazolás-kérés nem indul el. */
export default function UjIgazolas() {
  return (
    <ZaroltKapu feature="igazolas_keres" ful="fooldal" cim={CERT_FORM_TEXTS.newButton}>
      <ZarolasKapu cim={CERT_FORM_TEXTS.newButton}>
        <UjIgazolasTartalom />
      </ZarolasKapu>
    </ZaroltKapu>
  );
}
