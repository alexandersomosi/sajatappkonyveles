// S14 – NAV-meghatalmazás (SPEC §27.4.4, §27.3). Felül a választás, mindkettő görgetés nélkül látszik 390×844-en: a
// KIEMELT „Megcsináljuk helyetted a meghatalmazást” (Bence beküldi, te csak jóváhagyod) és „Magam adom meg” (az
// ONYA-útmutató lépésenként, a végén „Beküldtem”). A sáv szövege a választást követi. Ha már kérte: a kérés állapota
// (jóváhagyás határidővel, várakozás, kész). Minden állapotban „Elakadtál? Kérj visszahívást”.
// Régi változat: kod/app/_regi/elotte_tulaj1119/meghatalmazas_route_athelyezve.tsx.
import { useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import type { Guide } from '@/_shared/api';
import { ASSIST_TEXTS, fillPlaceholders, WAITING_TEXTS } from '@/_shared/bekotes';
import { ApiHiba } from '@/api/http';
import { useMeghatalmazas, useSegitsegMegsemJovahagytam, useUtmutato, useUtmutatoHaladas, useUtmutatoKepek } from '@/api/hooks';
import { csatolmanyFeltolt, letoltMegnyit, type HelyiFajl } from '@/lib/fajlok';
import { maiNap } from '@/lib/format';
import { hibaUzenet } from '@/lib/hiba';
import { szovegLista } from '@/lib/szovegek';
import { elo, helyettunkUt, segitsegFajta, segitsegSzoveg } from '@/lib/ut';
import { utmutatoEpit } from '@/lib/utmutato';
import { SavCim, SegitsegCsik, useHaladas, useLepesParam, UtmutatoLepesenkent, UtmutatoTorzs } from '@/kepernyok/Utmutato';
import { forma, szin } from '@/theme/tokens';
import { GombE, GombM, GombSz, HibaSzoveg, Lap } from '@/ui/alap';
import { IgyMegy, JovahagyasKartya, SohaBelepes } from '@/ui/Helyettunk';
import { Ikon3d, Targykep } from '@/ui/kepek';
import { Betolt, Hiba, Kepernyo, useJelzes, vissza } from '@/ui/keret';
import { T } from '@/ui/T';
import { KiemeltKartya, SegitsegAllapot, useUt, VarakozasKartya } from '@/ui/Ut';
import { Elakadtal } from '@/ui/Visszahivas';
import { bekotesre } from '@/lib/vezetett';

function Kesz({ cim, szoveg }: { cim: string; szoveg: string }) {
  return (
    <Lap style={{ padding: 18, alignItems: 'center' }}>
      <Targykep nev="meghatalmazas_alairva" style={{ marginBottom: 10 }} />
      <T m={17} s={650} lh={1.4} kozep>
        {cim}
      </T>
      <T m={15.5} c={szin.halvany} lh={1.5} kozep style={{ marginTop: 4 }}>
        {szoveg}
      </T>
    </Lap>
  );
}

export default function Meghatalmazas() {
  const { o, j } = useUt();
  const p = useLocalSearchParams<{ mod?: string; egyben?: string }>();
  const kuld = useMeghatalmazas();
  const megsem = useSegitsegMegsemJovahagytam();
  const jelez = useJelzes();
  const [fajl, setFajl] = useState<{ nev: string; fileId: string } | null>(null);
  const [tolt, setTolt] = useState(false);
  const [hiba, setHiba] = useState<string | null>(null);
  const d = o.data;
  const lepes = d?.steps.find((s) => s.step === 'meghatalmazas');
  const segitett = j?.variant === 'inditas_segitett';
  const a = d ? (segitett ? segitsegFajta(d.assists, 'vallalkozas_bejelentes') : null) ?? segitsegFajta(d.assists, 'meghatalmazas') : null;
  const magam = p.mod === 'magam';
  const kell = !!d && magam && !lepes?.locked && !(lepes && ['konyvelore_var', 'kesz'].includes(lepes.status));
  const utmutato = useUtmutato('meghatalmazas', kell);
  const kepek = useUtmutatoKepek('meghatalmazas');
  const haladasMent = useUtmutatoHaladas('meghatalmazas');
  // Régebbi szerver (nincs /client/guides): ugyanabból a sablonból itt építjük fel, az onyaGuide adataival.
  const nincsVegpont = utmutato.error instanceof ApiHiba && utmutato.error.status === 404 && utmutato.error.code === 'not_found';
  const ug = d?.onyaGuide;
  const g: Guide | undefined =
    utmutato.data ??
    (nincsVegpont && d
      ? utmutatoEpit('meghatalmazas', {
          answers: null,
          nev: '',
          lakcim: null,
          konyvelo: { nev: ug?.accountantName ?? d.accountant.displayName, firstName: d.accountant.firstName, adoazonosito: ug?.accountantTaxId ?? null, nyilvantartasiSzam: d.accountant.registrationNumber },
          ugykorok: ug?.ugykorok?.length ? ug.ugykorok : szovegLista('meghatalmazas.ugykorok'),
          kesz: [],
          ma: maiNap(),
        })
      : undefined);
  const haladas = useHaladas('meghatalmazas', g, (k) => haladasMent.mutateAsync(k));
  const lp = useLepesParam(g?.steps.length ?? 0);
  if (!d) return <Kepernyo ful="fooldal"><Betolt /></Kepernyo>;
  const acc = d.accountant;
  const fn = acc.firstName;
  const fej = (sub: string) => <SavCim vissza={() => (magam && p.egyben !== '1' && lp.lepes > 0 ? lp.ugrik(0) : vissza('/bekotes'))} visszaCim={magam && lp.lepes > 0 ? 'Vissza a bevezetőhöz' : 'Vissza a Főoldalra'} cim="NAV-meghatalmazás" al={sub} />;
  const elakadtal = <Elakadtal forras="meghatalmazas_utmutato" tema="meghatalmazas" style={{ marginTop: 8, marginLeft: 4 }} />;

  async function bekuld(mod: 'onya_ugyfel' | 'alairt_pdf') {
    if (mod === 'alairt_pdf' && !fajl) return setHiba('Töltsd fel az aláírt PDF-et.');
    setHiba(null);
    try {
      await kuld.mutateAsync({ method: mod, fileId: fajl?.fileId });
      jelez({ szoveg: `Köszönjük! ${fn} ellenőrzi a NAV-nál.`, kesz: true });
      bekotesre();
    } catch (e) {
      setHiba(hibaUzenet(e, 'Nem sikerült. Próbáld újra.'));
      jelez(hibaUzenet(e, 'Nem sikerült. Próbáld újra.'));
    }
  }

  // ---- A: „Megcsináljuk helyetted” – a kérés állapota ----
  if (elo(a)) {
    const varKulcs = a.status === 'visszahivas_kerve' ? 'helyettunk_hivas' : a.status === 'egyeztetve' ? 'helyettunk_ujegyke' : a.status === 'meghatalmazas_jovahagyva' ? 'helyettunk_ellenorzes' : null;
    const el = ['meghatalmazas_el', 'ugyfel_engedelyezte', 'bejelentes_bekuldve', 'kesz'].includes(a.status);
    // 11-19 javítás: az állapot-mondat EGYSZER látszik (eddig a fejlécben, a kiemelt kártyán és a várakozó kártyán is).
    const varKartya = !!varKulcs && j?.waiting?.key === varKulcs;
    const fejSzoveg = a.kind === 'meghatalmazas' ? `Kérted: ${ASSIST_TEXTS.mhCardTitle.charAt(0).toLocaleLowerCase('hu-HU')}${ASSIST_TEXTS.mhCardTitle.slice(1)}.` : `Kérted: ${fn} a bejelentéssel együtt ezt is intézi.`;
    return (
      <Kepernyo ful="fooldal" fejlec={fej(fejSzoveg)}>
        {el ? (
          <Kesz cim={`Él a meghatalmazás. ${fn} a NAV-nál is a könyvelőd.`} szoveg="Innentől ő intézi az adóügyeidet." />
        ) : varKartya || varKulcs || a.status === 'meghatalmazas_bekuldve' || a.status === 'meghatalmazas_lejart' ? null : (
          <SegitsegAllapot a={a} fn={fn} cb={d.callback ?? null} />
        )}
        {a.status === 'meghatalmazas_bekuldve' || a.status === 'meghatalmazas_lejart' ? <JovahagyasKartya a={a} fn={fn} /> : null}
        {varKartya && j?.waiting ? <VarakozasKartya w={j.waiting} forras="meghatalmazas_utmutato" /> : varKulcs ? (
          <Lap style={{ padding: 18, marginTop: 12 }}>
            <T m={17} s={650} lh={1.4}>
              {fillPlaceholders(WAITING_TEXTS[varKulcs].title, { firstName: fn })}
            </T>
            <T m={15.5} lh={1.5} c={szin.halvany} style={{ marginTop: 4 }}>
              {fillPlaceholders(WAITING_TEXTS[varKulcs].body, { firstName: fn, phoneMasked: d.callback?.phoneMasked ?? 'megadott' })}
            </T>
          </Lap>
        ) : null}
        {a.status === 'meghatalmazas_jovahagyva' ? (
          // 11-19 javítás: ha tévedésből nyomta meg a „Jóváhagytam”-ot, itt visszaléphet (nincs zsákutca)
          <GombSz
            cim={ASSIST_TEXTS.notApprovedYet}
            disabled={megsem.isPending}
            onPress={async () => {
              try {
                await megsem.mutateAsync(a.id);
                jelez({ szoveg: ASSIST_TEXTS.notApprovedYetToast, kesz: true });
              } catch (e) {
                jelez(hibaUzenet(e, 'Nem sikerült. Próbáld újra.'));
              }
            }}
            style={{ marginTop: 6, marginLeft: 4 }}
          />
        ) : null}
        {!el ? (
          <>
            <T m={19.5} s={600} lh={1.25} style={{ paddingTop: 26, paddingBottom: 10, paddingHorizontal: 4 }} accessibilityRole="header">
              Így megy
            </T>
            <IgyMegy fajta={a.kind} fn={fn} />
            <SohaBelepes fn={fn} style={{ marginTop: 12 }} />
          </>
        ) : null}
        {a.canCancel && a.kind === 'meghatalmazas' ? <GombSz cim={ASSIST_TEXTS.cancelLink} onPress={() => router.push(helyettunkUt('meghatalmazas', 'helyettunk_meghatalmazas'))} style={{ marginTop: 6, marginLeft: 4 }} /> : null}
        {elakadtal}
      </Kepernyo>
    );
  }

  // ---- B: zárt lépés (pl. az indítás-úton a bejelentés előtt); a szerződésre váró zárnál a kérés már kérhető ----
  if (lepes?.locked) {
    const szerzodesUtan = /szerz[őo]d/i.test(lepes.lockedReason ?? '');
    return (
      <Kepernyo ful="fooldal" fejlec={fej(`Így ${fn} intézheti helyetted az adóügyeidet a NAV-nál.`)}>
        <Lap style={{ padding: 18 }}>
          <View style={{ flexDirection: 'row', gap: 12, alignItems: 'center' }}>
            <Ikon3d nev="lakat" pt={44} label="Később" />
            <T m={17} s={600} lh={1.45} style={{ flex: 1 }}>
              {lepes.lockedReason ?? 'Ez a lépés később nyílik meg.'}
            </T>
          </View>
        </Lap>
        {szerzodesUtan ? (
          <KiemeltKartya
            style={{ marginTop: 12 }}
            jelveny={ASSIST_TEXTS.mhCardBadge}
            cim={ASSIST_TEXTS.mhCardTitle}
            szoveg={fillPlaceholders(ASSIST_TEXTS.mhCardBody, { firstName: fn })}
            gomb={ASSIST_TEXTS.cardButton}
            onPress={() => router.push(helyettunkUt('meghatalmazas', 'helyettunk_meghatalmazas'))}
          />
        ) : null}
        <GombM cim="Vissza a Főoldalra" onPress={() => router.navigate('/bekotes')} style={{ marginTop: 14 }} />
        {elakadtal}
      </Kepernyo>
    );
  }

  // ---- C: beküldte (ellenőrizzük) / kész ----
  if (lepes?.status === 'konyvelore_var' || lepes?.status === 'kesz') {
    return (
      <Kepernyo ful="fooldal" fejlec={fej(lepes.status === 'kesz' ? 'Kész.' : `Beküldted. ${fn} ellenőrzi.`)}>
        {lepes.status === 'kesz' ? (
          <Kesz cim={`${fn} a NAV-nál is a könyvelőd.`} szoveg="Innentől ő intézi a bevallásaidat." />
        ) : j?.waiting?.key === 'meghatalmazas_ellenorzes' ? (
          <VarakozasKartya w={j.waiting} forras="meghatalmazas_utmutato" />
        ) : (
          <Kesz cim={`${fn} ellenőrzi a NAV-nál.`} szoveg="Általában 1 munkanapon belül. Ha valamit pótolni kell, szólunk." />
        )}
        {elakadtal}
      </Kepernyo>
    );
  }

  // ---- D: magam adom meg – az ONYA-útmutató lépésenként (vagy egyben) ----
  if (magam) {
    if (!g) {
      return (
        <Kepernyo ful="fooldal" fejlec={fej('Így add meg a NAV-meghatalmazást – kb. 5 perc')}>
          {utmutato.isLoading ? <Betolt /> : <Hiba hiba={utmutato.error} ujra={() => void utmutato.refetch()} />}
          {elakadtal}
        </Kepernyo>
      );
    }
    const masikMod = <GombSz cim="Másik módot választok" onPress={() => router.setParams({ mod: undefined, lepes: undefined, egyben: undefined })} style={{ marginLeft: 4 }} />;
    if (p.egyben === '1') {
      return (
        <Kepernyo ful="fooldal" fejlec={fej('Így add meg a NAV-meghatalmazást – kb. 5 perc')}>
          {/* 11-19 javító kör 2: a kiemelt „Megcsináljuk helyetted” az egyben (nyomtatható) nézet tetején is ott van. */}
          <SegitsegCsik fajta="mh" fn={fn} onPress={() => router.push(helyettunkUt('meghatalmazas', 'meghatalmazas_utmutato'))} style={{ marginBottom: 12 }} />
          <UtmutatoTorzs g={g} kepek={kepek.data} valaszok={{}} kesz={haladas.kesz} valt={haladas.valt} fn={fn} />
          <HibaSzoveg szoveg={hiba} />
          <GombE cim="Beküldtem" onPress={() => void bekuld('onya_ugyfel')} tolt={kuld.isPending} style={{ marginTop: 16 }} />
          <GombSz cim="Lépésenként mutasd" onPress={() => router.setParams({ egyben: undefined, lepes: '0' })} style={{ marginLeft: 4 }} />
          {elakadtal}
        </Kepernyo>
      );
    }
    return (
      <Kepernyo ful="fooldal" gorgetoRef={lp.gorgeto} fejlec={fej('Így add meg a NAV-meghatalmazást – kb. 5 perc')}>
        {lepes?.status === 'hianyos' && lepes.note ? (
          <View style={{ borderRadius: 12, backgroundColor: szin.borostyanAlap, padding: 14, marginBottom: 12 }}>
            <T m={15.5} s={650} c={szin.borostyanSzoveg} lh={1.45}>
              {fn} kéri: {lepes.note}
            </T>
          </View>
        ) : null}
        <UtmutatoLepesenkent
          g={g}
          kepek={kepek.data}
          valaszok={{}}
          kesz={haladas.kesz}
          valt={haladas.valt}
          fn={fn}
          lepes={lp.lepes}
          ugrik={lp.ugrik}
          vege={{ cim: 'Beküldtem', onPress: () => void bekuld('onya_ugyfel'), tolt: kuld.isPending }}
          // 11-19 javítás (3. kérés: „ki kell emelni”): a magam-útmutató minden lépésén ott a kiemelt „Megcsináljuk helyetted”
          segitseg={() => router.push(helyettunkUt('meghatalmazas', 'meghatalmazas_utmutato'))}
          segitsegFajta="mh"
          egyben={() => router.setParams({ egyben: '1' })}
        />
        <HibaSzoveg szoveg={hiba} />
        {lp.lepes === 0 ? masikMod : null}
      </Kepernyo>
    );
  }

  // ---- E: aláírt PDF (csak ha a könyvelő kérte; rejtett mód) ----
  if (p.mod === 'pdf' && d.meghatalmazasMethods.includes('alairt_pdf')) {
    const valaszt = async () => {
      const r = await DocumentPicker.getDocumentAsync({ type: 'application/pdf', copyToCacheDirectory: true, multiple: false });
      if (r.canceled || !r.assets?.[0]) return;
      const f0 = r.assets[0];
      if ((f0.size ?? 0) > 25 * 1024 * 1024) return setHiba('A fájl legfeljebb 25 MB lehet.');
      setTolt(true);
      setHiba(null);
      try {
        const f: HelyiFajl = { uri: f0.uri, nev: f0.name, mime: f0.mimeType ?? 'application/pdf', webFajl: f0.file };
        const { fileId } = await csatolmanyFeltolt(f);
        setFajl({ nev: f0.name, fileId });
      } catch (e) {
        setHiba(hibaUzenet(e, 'Nem sikerült feltölteni.'));
      } finally {
        setTolt(false);
      }
    };
    return (
      <Kepernyo ful="fooldal" fejlec={fej(`Aláírt PDF – csak mert ${fn} ezt kérte.`)}>
        <Lap style={{ padding: 18, gap: 12 }}>
          <T m={16} lh={1.45}>1. Töltsd le az előre kitöltött meghatalmazást.</T>
          <GombSz cim="PDF letöltése" onPress={() => letoltMegnyit('/client/legal-pdf/nav_meghatalmazas', 'nav_meghatalmazas.pdf', 'application/pdf').catch((e: unknown) => jelez(hibaUzenet(e, 'Nem sikerült. Próbáld újra.')))} />
          <T m={16} lh={1.45}>2. Írd alá elektronikusan, például a DÁP eAláírással (dap.gov.hu, Digitális aláírás menü).</T>
          <T m={16} lh={1.45}>3. Töltsd fel ide az aláírt PDF-et.</T>
          <GombM cim={fajl ? `Feltöltve: ${fajl.nev}` : 'Aláírt PDF feltöltése'} ikon="feltoltes" tolt={tolt} onPress={() => void valaszt()} />
        </Lap>
        <HibaSzoveg szoveg={hiba} />
        <GombE cim="Beküldtem" onPress={() => void bekuld('alairt_pdf')} tolt={kuld.isPending} style={{ marginTop: 16 }} />
        <GombSz cim="Másik módot választok" onPress={() => router.setParams({ mod: undefined })} style={{ marginLeft: 4 }} />
        {elakadtal}
      </Kepernyo>
    );
  }

  // ---- F: a választás (S14) ----
  return (
    <Kepernyo ful="fooldal" fejlec={fej(`Így ${fn} intézheti helyetted az adóügyeidet a NAV-nál.`)}>
      {lepes?.status === 'hianyos' && lepes.note ? (
        <View style={{ borderRadius: 12, backgroundColor: szin.borostyanAlap, padding: 14, marginBottom: 12 }}>
          <T m={15.5} s={650} c={szin.borostyanSzoveg} lh={1.45}>
            {fn} kéri: {lepes.note}
          </T>
        </View>
      ) : null}
      <KiemeltKartya
        jelveny={ASSIST_TEXTS.mhCardBadge}
        cim={ASSIST_TEXTS.mhCardTitle}
        szoveg={fillPlaceholders(ASSIST_TEXTS.mhCardBody, { firstName: fn })}
        gomb={ASSIST_TEXTS.cardButton}
        elsodleges
        onPress={() => router.push(helyettunkUt('meghatalmazas', 'helyettunk_meghatalmazas'))}
      />
      <View style={{ marginTop: 12, backgroundColor: szin.lap, borderRadius: forma.lap, padding: 16 }}>
        <View style={{ flexDirection: 'row', gap: 12, alignItems: 'flex-start' }}>
          <Ikon3d nev="irat" pt={44} />
          <View style={{ flex: 1 }}>
            <T m={18} s={700} lh={1.3}>
              Magam adom meg
            </T>
            <T m={15.5} lh={1.5} c={szin.halvany} style={{ marginTop: 4 }}>
              Kb. 5 perc az ONYA-ban, képekkel és videóval segítünk.
            </T>
          </View>
        </View>
        <GombM cim="Ezt választom" onPress={() => router.setParams({ mod: 'magam', lepes: '0' })} style={{ marginTop: 12 }} />
      </View>
      {d.meghatalmazasMethods.includes('alairt_pdf') ? <GombSz cim={`${fn} aláírt PDF-et kért tőlem`} onPress={() => router.setParams({ mod: 'pdf' })} style={{ marginTop: 6, marginLeft: 4 }} /> : null}
      {elakadtal}
    </Kepernyo>
  );
}
