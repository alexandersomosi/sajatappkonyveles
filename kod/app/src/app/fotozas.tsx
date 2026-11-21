// 09 Fotózás (FUNKCIOK 13) – v2 (k8, minta: dizajn/C5_v2/64_fotozas): telefonon a keret alatt egy sor: balra Galéria,
// középen az exponáló, jobbra „Fájl, PDF”; a vaku kapcsolója a keret sarkában. Natívan, ahol van, az iratszkenner fut
// (automatikus élkeresés, több oldal: Android ML Kit / iOS VisionKit), de a Galéria és a „Fájl, PDF” mindig látszik.
// Exponáláskor villanás, és a kép bélyegképként a Dosszié felé „repül” (csökkentett mozgásnál egyik sincs).
// Átnézés: oldalcsík, „Ezt újra”, „+” újabb oldal, „Kész, feltöltöm” → kategória és hónap → feltöltés.
// Gépen (≥ 1024 pt, web) fájlfeltöltő oldal: szaggatott keretes feltöltő sáv behúzással, „Fájl kiválasztása”.
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, Pressable, TurboModuleRegistry, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHome, useKeresek, useKeresKesz } from '@/api/hooks';
import { MINTA_MOD } from '@/config';
import { ENGEDETT, iratFeltolt, MAX_MERET, type HelyiFajl } from '@/lib/fajlok';
import { useAsztali } from '@/lib/elrendezes';
import { Csempe, Ikon, VezerloIkon } from '@/_shared/v2/rn';
import { GombE, GombM, KartyaFej, Lap } from '@/ui/alap';
import { CimSor, Fulsor, FULSOR_MAGASSAG, Kepernyo } from '@/ui/keret';
import { BehuzoSav } from '@/ui/asztali/BehuzoSav';
import { ErkezoElem, RepuloKep, Villanas } from '@/ui/mozgas';
import { DemoPirula } from '@/ui/demoAllapot';
import { mozgasKi } from '@/lib/mozgas';
import { szin } from '@/theme/tokens';
import { Arckep, KeszJel } from '@/ui/kepek';
import { useJelzes } from '@/ui/keret';
import { T } from '@/ui/T';
import { ZaroltKapu } from '@/ui/Zarolt';
import { FeltoltesLap } from '@/kepernyok/FeltoltesLap';

import { MINTA_KEPEK } from '@/api/minta/kepek';
import { hibaUzenet } from '@/lib/hiba';
const MINTA_KEP = MINTA_KEPEK.nyugta;
// a szkenner TurboModule; ha nincs a buildben (Expo Go), TurboModuleRegistry.get null-t ad → kamera
const SZKENNER = Platform.OS !== 'web' && !!TurboModuleRegistry.get('DocumentScanner');

async function szkennel(): Promise<string[] | null> {
  try {
    const mod = (await import('react-native-document-scanner-plugin')).default;
    const r = await mod.scanDocument({ maxNumDocuments: 20, croppedImageQuality: 90 });
    if (r.status === 'cancel') return [];
    return r.scannedImages ?? [];
  } catch {
    return null; // nincs natív modul → kamera
  }
}

/** Sarokjelek. `ugrik`: a tágabb keretről ~200 ms alatt „ráugranak” a papír sarkaira (TERV §6); csökkentett mozgásnál
 *  (és a képernyőképeknél) azonnal a helyükön vannak. */
function Sarkok({ szin: s = '#6FD3A0', ugrik = false }: { szin?: string; ugrik?: boolean }) {
  const t = useRef(new Animated.Value(ugrik ? 0 : 1)).current;
  useEffect(() => {
    if (!ugrik) return;
    let el = true;
    void mozgasKi().then((rm) => {
      if (!el) return;
      if (rm) return t.setValue(1);
      Animated.timing(t, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
    });
    return () => {
      el = false;
    };
  }, [ugrik, t]);
  const k = { position: 'absolute' as const, width: 30, height: 30, borderColor: s };
  return (
    <Animated.View
      pointerEvents="none"
      style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: t.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1] }), transform: [{ scale: t.interpolate({ inputRange: [0, 1], outputRange: [1.18, 1] }) }] }}
    >
      <View style={[k, { left: -4, top: -4, borderLeftWidth: 6, borderTopWidth: 6, borderTopLeftRadius: 6 }]} />
      <View style={[k, { right: -4, top: -4, borderRightWidth: 6, borderTopWidth: 6, borderTopRightRadius: 6 }]} />
      <View style={[k, { left: -4, bottom: -4, borderLeftWidth: 6, borderBottomWidth: 6, borderBottomLeftRadius: 6 }]} />
      <View style={[k, { right: -4, bottom: -4, borderRightWidth: 6, borderBottomWidth: 6, borderBottomRightRadius: 6 }]} />
    </Animated.View>
  );
}

function Kerek({ cim, onPress }: { cim: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} hitSlop={4} style={({ pressed }) => ({ minHeight: 44, paddingHorizontal: 16, borderRadius: 999, backgroundColor: pressed ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.12)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', justifyContent: 'center' })}>
      <T m={16} s={650} c="#fff" ls={-0.005}>
        {cim}
      </T>
    </Pressable>
  );
}

/** A papír mérete a területen belül: a kép arányával, legfeljebb a terület 84%-a. */
function papirMeret(t: { w: number; h: number }, arany: number): { width: number; height: number } {
  const maxW = t.w * 0.84;
  const maxH = t.h * 0.84;
  const w = Math.min(maxW, maxH * arany);
  return { width: Math.round(w), height: Math.round(w / arany) };
}

function FotozasTartalom() {
  const p = useLocalSearchParams<{ demo?: string; keres?: string; kategoria?: string; honap?: string }>();
  const ins = useSafeAreaInsets();
  const home = useHome();
  const qc = useQueryClient();
  const jelez = useJelzes();
  const fn = home.data?.accountant.firstName ?? 'A könyvelőd';
  const [engedely, kerEngedely] = useCameraPermissions();
  const kamera = useRef<CameraView>(null);
  const [lapok, setLapok] = useState<HelyiFajl[]>([]);
  const [aktiv, setAktiv] = useState(0);
  const [mod, setMod] = useState<'kamera' | 'atnez'>('kamera');
  const [vaku, setVaku] = useState<'auto' | 'on' | 'off'>('auto');
  const [kesz, setKesz] = useState(false);
  const [lap, setLap] = useState(false);
  const [folyamat, setFolyamat] = useState<number | null>(null);
  const [feltoltesHiba, setFeltoltesHiba] = useState<string | null>(null);
  const [terulet, setTerulet] = useState<{ w: number; h: number } | null>(null);
  const [arany, setArany] = useState(358 / 214);
  const keresek = useKeresek();
  const keresKesz = useKeresKesz();
  const [szkennerProbalt, setSzkennerProbalt] = useState(false);
  /** „Fájl, PDF”: egyetlen PDF (képeket a lapok közé tesszük). */
  const [pdf, setPdf] = useState<HelyiFajl | null>(null);
  const [valasztoHiba, setValasztoHiba] = useState<string | null>(null);
  /** Mozgás #7: villanás + repülő bélyegkép jele (minden új fotó növeli). */
  const [villan, setVillan] = useState(0);
  const [repuloUri, setRepuloUri] = useState<string | null>(null);
  const asztali = useAsztali();
  const felul = Platform.OS === 'web' ? 14 : ins.top + 4;

  // MINTA: a 09-es képernyő állapota két lefotózott oldallal
  useEffect(() => {
    if (MINTA_MOD && p.demo) {
      setLapok([{ uri: 'minta:nyugta', nev: '1.jpg', mime: 'image/jpeg' }, { uri: 'minta:nyugta', nev: '2.jpg', mime: 'image/jpeg' }]);
      setAktiv(1);
      setMod('atnez');
    }
  }, [p.demo]);

  // natív szkenner, ha van
  useEffect(() => {
    if (!SZKENNER || szkennerProbalt || (MINTA_MOD && p.demo)) return;
    setSzkennerProbalt(true);
    void (async () => {
      const kepek = await szkennel();
      if (kepek === null) return; // kamera marad
      if (!kepek.length) {
        router.back();
        return;
      }
      setLapok(kepek.map((u, i) => ({ uri: u.startsWith('file:') || u.startsWith('content:') ? u : `file://${u}`, nev: `${i + 1}.jpg`, mime: 'image/jpeg' })));
      setAktiv(kepek.length - 1);
      setMod('atnez');
    })();
  }, [szkennerProbalt, p.demo]);

  async function fenykep() {
    try {
      const k = await kamera.current?.takePictureAsync({ quality: 0.85, exif: false, skipProcessing: false });
      if (!k) return;
      setLapok((l) => [...l, { uri: k.uri, nev: `${l.length + 1}.jpg`, mime: 'image/jpeg' }]);
      setAktiv(lapok.length);
      setRepuloUri(k.uri);
      setVillan((v) => v + 1);
      setMod('atnez');
    } catch {
      jelez('Nem sikerült a fotó. Próbáld újra.');
    }
  }
  /** Weben (telefon böngészője) az exponáló a telefon kameráját nyitja (a böngésző fájlválasztója capture-rel). */
  async function webFoto() {
    try {
      const r = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.9 });
      if (r.canceled || !r.assets?.length) return;
      const a = r.assets[0];
      setLapok((l) => [...l, { uri: a.uri, nev: a.fileName ?? `${l.length + 1}.jpg`, mime: a.mimeType ?? 'image/jpeg', webFajl: a.file }]);
      setAktiv(lapok.length);
      setRepuloUri(a.uri);
      setVillan((v) => v + 1);
      setMod('atnez');
    } catch {
      void galeria();
    }
  }
  /** „Fájl, PDF”: egy PDF vagy több kép a fájlok közül (ugyanaz az átnéző és feltöltő folyamat). */
  async function fajlValaszt() {
    setValasztoHiba(null);
    const r = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/jpeg', 'image/png', 'image/heic'], multiple: true, copyToCacheDirectory: true });
    if (r.canceled || !r.assets?.length) return;
    fajlokHozzaad(r.assets.map((a) => ({ uri: a.uri, nev: a.name, mime: a.mimeType ?? (a.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'), meret: a.size, webFajl: a.file })));
  }
  function fajlokHozzaad(lista: HelyiFajl[]) {
    setValasztoHiba(null);
    for (const f of lista) {
      if (!ENGEDETT.test(f.mime)) return setValasztoHiba(`${f.nev}: csak PDF-et vagy fényképet tudunk fogadni.`);
      if ((f.meret ?? 0) > MAX_MERET) return setValasztoHiba(`${f.nev}: legfeljebb 25 MB lehet.`);
    }
    const pdfek = lista.filter((f) => f.mime === 'application/pdf');
    if (pdfek.length && (lista.length > 1 || lapok.length)) return setValasztoHiba('Egyszerre egy PDF-et tölts fel, vagy több fényképet.');
    if (pdfek.length) {
      setPdf(pdfek[0]);
      setMod('atnez');
      return;
    }
    setPdf(null);
    setLapok((l) => [...l, ...lista]);
    setAktiv(lapok.length + lista.length - 1);
    setMod('atnez');
  }
  async function galeria() {
    const r = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.9, allowsMultipleSelection: true, selectionLimit: 20 });
    if (r.canceled) return;
    const uj = r.assets.map((a, i) => ({ uri: a.uri, nev: a.fileName ?? `${lapok.length + i + 1}.jpg`, mime: a.mimeType ?? 'image/jpeg', webFajl: a.file }));
    setLapok((l) => [...l, ...uj]);
    setAktiv(lapok.length + uj.length - 1);
    setMod('atnez');
  }
  function ujra() {
    if (pdf) {
      setPdf(null);
      setMod('kamera');
      return;
    }
    setLapok((l) => l.filter((_, i) => i !== aktiv));
    setAktiv(Math.max(0, aktiv - 1));
    setMod('kamera');
  }
  async function hozzaad() {
    if (SZKENNER) {
      const kepek = await szkennel();
      if (kepek?.length) {
        setLapok((l) => [...l, ...kepek.map((u, i) => ({ uri: u.startsWith('file:') ? u : `file://${u}`, nev: `${l.length + i + 1}.jpg`, mime: 'image/jpeg' }))]);
        setAktiv(lapok.length + kepek.length - 1);
        return;
      }
    }
    setMod('kamera');
  }

  async function feltolt(kategoria: string, honap: string, megjegyzes?: string) {
    setFolyamat(0);
    try {
      // A megjegyzés első szavai jó címnek (pl. „Papírbolt, nyomtatópapír”); enélkül a kategória neve marad.
      const cim = megjegyzes?.trim() ? megjegyzes.trim().split(/\s+/).slice(0, 6).join(' ').replace(/[.,;:!?]+$/, '').slice(0, 60) : undefined;
      setFeltoltesHiba(null);
      const irat = await iratFeltolt({ lapok: pdf ? undefined : lapok, fajl: pdf ?? undefined, kategoria, honap, megjegyzes, cim, keresId: p.keres, folyamat: setFolyamat });
      // A könyvelő kérésére fotózott irat a kérést is lezárja (SPEC §6.4).
      let lezarva = false;
      const k = p.keres ? (keresek.data ?? (await keresek.refetch()).data)?.items.find((x) => x.id === p.keres) : undefined;
      if (k && irat?.id && k.direction === 'konyvelotol' && (k.status === 'nyitott' || k.status === 'folyamatban')) {
        try {
          await keresKesz.mutateAsync({ id: k.id, documentIds: [irat.id] });
          lezarva = true;
        } catch {
          /* a feltöltés megvan, a kérést kézzel is lezárhatja */
        }
      }
      await qc.invalidateQueries({ queryKey: ['dosszie'] });
      await qc.invalidateQueries({ queryKey: ['home'] });
      await qc.invalidateQueries({ queryKey: ['keresek'] });
      setLap(false);
      setKesz(true);
      jelez({ szoveg: lezarva ? `Feltöltötted, ${fn} megkapta. A kérését lezártuk.` : `Feltöltve. ${fn} megkapta.`, kesz: true });
      setTimeout(() => router.replace({ pathname: '/dosszie', params: { honap } }), 900);
    } catch (e) {
      // A lapon belül látszik (a jelzés a függöny mögé kerülne).
      setFeltoltesHiba(hibaUzenet(e, 'Nem sikerült feltölteni. Próbáld újra.'));
    } finally {
      setFolyamat(null);
    }
  }

  const aktivLap = lapok[aktiv];
  const mintaForras = MINTA_MOD && p.demo ? MINTA_KEP : null;
  const oldalak = pdf ? 1 : lapok.length;
  const feltoltoLap = (
    <FeltoltesLap
      lathato={lap}
      bezar={() => setLap(false)}
      kezdoKategoria={p.kategoria ?? (pdf ? 'egyeb' : 'nyugta')}
      kezdoHonap={p.honap}
      oldalak={oldalak}
      fajlNev={pdf?.nev}
      folyamat={folyamat}
      kuld={feltolt}
      hiba={feltoltesHiba}
    />
  );

  // ---------- gépen: fájlfeltöltő oldal ----------
  if (asztali) {
    const fajlok: HelyiFajl[] = pdf ? [pdf] : lapok;
    return (
      <Kepernyo ful="fotozas" fejlec={<CimSor cim="Fotózás és feltöltés" al={`Válaszd ki vagy húzd ide az iratot. ${fn} megkapja, és a helyére teszi.`} />}>
        <BehuzoSav onFajlok={fajlokHozzaad} style={{ marginBottom: 14 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, paddingVertical: 22, paddingHorizontal: 22 }}>
            <Csempe nev="feltolt" />
            <View style={{ flex: 1 }}>
              <T m={18} s={750} lh={1.3}>
                Húzd ide a fájlt, vagy válaszd ki a gépedről
              </T>
              <T m={15} c={szin.halvany} lh={1.45} style={{ marginTop: 2 }}>
                Legfeljebb 25 MB, PDF vagy fénykép. Több fényképből egy irat lesz.
              </T>
            </View>
            <GombE cim="Fájl kiválasztása" ikon="feltoltes" onPress={() => void fajlValaszt()} style={{ alignSelf: 'center' }} />
          </View>
        </BehuzoSav>
        {valasztoHiba ? (
          <T m={15} s={600} c={szin.veszely} style={{ marginBottom: 12 }} accessibilityLiveRegion="polite">
            {valasztoHiba}
          </T>
        ) : null}
        {fajlok.length ? (
          <Lap belso>
            <KartyaFej ikon="dosszie" cim={kesz ? 'Feltöltve' : `${fajlok.length} fájl kiválasztva`} al={pdf ? 'A PDF egy iratként megy fel.' : 'A fényképek egy iratként mennek fel, ebben a sorrendben.'} />
            <View style={{ marginTop: 10 }}>
              {fajlok.map((f, i) => (
                <ErkezoElem key={`${f.uri}-${i}`} uj>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderTopWidth: i ? 1 : 0, borderTopColor: szin.hajszal }}>
                    {f.mime === 'application/pdf' ? <Csempe nev="irat" meret="kicsi" /> : <Image source={{ uri: f.uri }} style={{ width: 36, height: 36, borderRadius: 8 }} resizeMode="cover" />}
                    <T m={15.5} s={650} style={{ flex: 1 }} numberOfLines={1}>
                      {f.nev}
                    </T>
                    {!kesz ? (
                      <Pressable
                        accessibilityRole="button"
                        accessibilityLabel={`${f.nev} eltávolítása`}
                        onPress={() => (pdf ? setPdf(null) : setLapok((l) => l.filter((_, j) => j !== i)))}
                        style={({ hovered }: { pressed: boolean; hovered?: boolean }) => ({ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: hovered ? szin.hoverAlap : 'transparent' })}
                      >
                        <VezerloIkon nev="bezar" pt={20} szin={szin.halvany} />
                      </Pressable>
                    ) : (
                      <KeszJel pt={22} />
                    )}
                  </View>
                </ErkezoElem>
              ))}
            </View>
            {!kesz ? (
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 14, maxWidth: 520 }}>
                <GombM cim="Még egy fájl" ikon="feltoltes" magas={50} onPress={() => void fajlValaszt()} style={{ flex: 1 }} />
                <GombM cim="Kész, feltöltöm" magas={50} onPress={() => setLap(true)} style={{ flex: 1 }} />
              </View>
            ) : null}
          </Lap>
        ) : (
          <Lap belso>
            <KartyaFej ikon="kamera" cim="Fotó a telefonnal" al="A telefonodon a Fotózás gombbal le is fotózhatod az iratot: a fotó ide, a dossziédba kerül." />
          </Lap>
        )}
        {feltoltoLap}
      </Kepernyo>
    );
  }

  // ---------- telefon: kamera (v2 64_fotozas) ----------
  const kameraVan = Platform.OS !== 'web' && !!engedely?.granted;
  const NAV = FULSOR_MAGASSAG + (Platform.OS === 'web' ? 6 : ins.bottom);
  return (
    <View style={{ flex: 1, backgroundColor: szin.kamera }}>
      {/* felső sor: Mégse · {fn} kapja meg */}
      <View style={{ paddingTop: felul + 4, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          <Kerek cim="Mégse" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
          <DemoPirula kicsi />
        </View>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, flexShrink: 1 }}>
          <View style={{ borderRadius: 17, borderWidth: 2, borderColor: 'rgba(255,255,255,0.7)' }}>
            <Arckep pt={30} />
          </View>
          <T m={15.5} s={650} c="#fff" numberOfLines={1} style={{ flexShrink: 1 }}>
            {fn} kapja meg
          </T>
        </View>
      </View>

      {/* a keret (a kamera képe vagy az átnézett oldal) */}
      <View style={{ flex: 1, marginTop: 18, marginHorizontal: 28, marginBottom: 16 }}>
        <View style={{ flex: 1, borderRadius: 6, backgroundColor: '#151B2D', overflow: 'hidden' }} onLayout={(e) => setTerulet({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
          {mod === 'kamera' && kameraVan ? <CameraView ref={kamera} style={{ flex: 1 }} facing="back" flash={vaku} /> : null}
          {mod === 'kamera' && !kameraVan ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, gap: 14 }}>
              <Ikon nev="kamera" pt={56} />
              <T m={15.5} c="#C9D2E3" kozep lh={1.5}>
                {Platform.OS === 'web' ? 'Az exponáló a telefonod kameráját nyitja meg.' : 'A fotózáshoz engedélyezd a kamerát.'}
              </T>
              {Platform.OS !== 'web' ? <GombE cim="Engedélyezem a kamerát" onPress={() => void kerEngedely()} style={{ alignSelf: 'center' }} /> : null}
            </View>
          ) : null}
          {mod === 'atnez' && pdf ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12, paddingHorizontal: 24 }}>
              <Csempe nev="irat" meret="nagy" />
              <T m={16} s={650} c="#fff" kozep numberOfLines={2}>
                {pdf.nev}
              </T>
            </View>
          ) : null}
          {mod === 'atnez' && !pdf && aktivLap && terulet ? (
            <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
              {/* A sarokjelek a papír saját sarkain ülnek: a doboz pontosan a kép arányát kapja (nem doboz a dobozban). */}
              <View style={{ ...papirMeret(terulet, arany), transform: [{ rotate: '-0.6deg' }] }}>
                <Image
                  source={mintaForras ?? { uri: aktivLap.uri }}
                  style={{ width: '100%', height: '100%', borderRadius: 2 }}
                  resizeMode="contain"
                  accessibilityLabel={`${aktiv + 1}. oldal`}
                  // A kép valódi oldalaránya: a doboz ehhez igazodik, így a sarokjelek a papír sarkain ülnek.
                  onLoad={(e) => {
                    const f = (e.nativeEvent as { source?: { width?: number; height?: number } }).source;
                    if (f?.width && f?.height) setArany(f.width / f.height);
                  }}
                />
                {/* laponként újra „ráugrik” (key): a frissen lefotózott oldal sarkait jelöli */}
                <Sarkok ugrik key={`${aktiv}-${aktivLap.uri}`} />
              </View>
            </View>
          ) : null}
          {mod === 'atnez' && lapok.length > 1 && !pdf ? (
            <View pointerEvents="none" style={{ position: 'absolute', bottom: 12, alignSelf: 'center', height: 30, paddingHorizontal: 11, borderRadius: 8, backgroundColor: 'rgba(11,15,30,0.7)', justifyContent: 'center' }}>
              <T m={14} s={650} c="#fff">
                {aktiv + 1}. oldal
              </T>
            </View>
          ) : null}
          <Villanas jel={villan} />
        </View>
        {mod === 'kamera' ? <Sarkok szin="#EEF0F6" /> : null}
        {mod === 'kamera' && kameraVan ? (
          // a vaku kapcsolója a keret jobb felső sarkában (v2 64_fotozas)
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Vaku: ${vaku === 'auto' ? 'automatikus' : vaku === 'on' ? 'bekapcsolva' : 'kikapcsolva'}`}
            onPress={() => setVaku((v) => (v === 'auto' ? 'on' : v === 'on' ? 'off' : 'auto'))}
            style={{ position: 'absolute', top: 16, right: 16, flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 36, paddingHorizontal: 12, borderRadius: 999, backgroundColor: 'rgba(11,15,30,0.72)' }}
          >
            <Ikon nev="vaku" pt={20} />
            <T m={15} s={650} c="#fff">
              {vaku === 'auto' ? 'Auto' : vaku === 'on' ? 'Be' : 'Ki'}
            </T>
          </Pressable>
        ) : null}
        {mod === 'atnez' ? (
          <View pointerEvents="none" style={{ position: 'absolute', top: 12, left: 0, right: 0, alignItems: 'center' }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 36, paddingLeft: 8, paddingRight: 14, borderRadius: 999, backgroundColor: '#fff' }}>
              <KeszJel pt={22} />
              <T m={15} s={650}>
                {kesz ? 'Feltöltve' : oldalak > 1 ? `${oldalak} oldal hozzáadva` : 'Hozzáadva. Nézd meg, olvasható-e.'}
              </T>
            </View>
          </View>
        ) : null}
      </View>

      {/* a keret alatti két sor */}
      <View style={{ paddingHorizontal: 24, alignItems: 'center' }}>
        <T m={17} s={750} c="#fff" kozep>
          {oldalak ? `${oldalak} oldal` : 'Még nincs oldal'}
        </T>
        <T m={15} c={valasztoHiba ? '#FFB4AE' : '#C9D2E3'} kozep lh={1.45} style={{ marginTop: 2 }} accessibilityLiveRegion="polite">
          {valasztoHiba ?? (oldalak ? 'Ha van még lap, fotózd hozzá.' : 'Fotózd le sötét alapon, vagy válaszd ki a galériából vagy a fájljaid közül (PDF is jó).')}
        </T>
      </View>

      {/* vezérlők: Galéria · exponáló · Fájl, PDF  /  átnézésnél: oldalcsík + Ezt újra + Kész, feltöltöm */}
      {mod === 'kamera' ? (
        <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-around', paddingTop: 18, paddingBottom: NAV + 18, paddingHorizontal: 12 }}>
          <KorGomb ikon="kep" cim="Galéria" onPress={() => void galeria()} />
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Fénykép készítése"
            onPress={() => void (kameraVan ? fenykep() : Platform.OS === 'web' ? webFoto() : kerEngedely())}
            style={({ pressed }) => ({ width: 80, height: 80, borderRadius: 40, borderWidth: 5, borderColor: '#fff', alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.85 : 1 })}
          >
            {({ pressed }) => <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#fff', transform: [{ scale: pressed ? 0.92 : 1 }] }} />}
          </Pressable>
          <KorGomb ikon="irat" cim="Fájl, PDF" onPress={() => void fajlValaszt()} />
        </View>
      ) : (
        <View style={{ paddingTop: 14, paddingBottom: NAV + 14, paddingHorizontal: 16, gap: 14 }}>
          {!pdf ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {lapok.map((l, i) => (
                <Pressable
                  key={i}
                  accessibilityRole="button"
                  accessibilityLabel={`${i + 1}. oldal`}
                  onPress={() => {
                    setAktiv(i);
                    setMod('atnez');
                  }}
                  style={{ width: 44, height: 56, borderRadius: 8, overflow: 'hidden', backgroundColor: '#2A3039', borderWidth: i === aktiv ? 2 : 0, borderColor: '#fff' }}
                >
                  <Image source={mintaForras ?? { uri: l.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
                </Pressable>
              ))}
              {lapok.length < 20 && !kesz ? (
                <Pressable accessibilityRole="button" accessibilityLabel="Még egy oldal" onPress={() => void hozzaad()} style={{ width: 44, height: 56, borderRadius: 8, borderWidth: 1.5, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.5)', alignItems: 'center', justifyContent: 'center' }}>
                  <VezerloIkon nev="plusz" pt={22} szin="#fff" />
                </Pressable>
              ) : null}
            </View>
          ) : null}
          <View style={{ flexDirection: 'row', gap: 10 }}>
            <Pressable accessibilityRole="button" onPress={ujra} disabled={kesz} style={({ pressed }) => ({ minHeight: 52, paddingHorizontal: 20, borderRadius: 14, backgroundColor: pressed ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.12)', justifyContent: 'center' })}>
              <T m={16.5} s={700} c="#fff">
                Ezt újra
              </T>
            </Pressable>
            <GombE cim="Kész, feltöltöm" disabled={!oldalak || kesz} onPress={() => setLap(true)} style={{ flex: 1 }} />
          </View>
        </View>
      )}
      <RepuloKep jel={villan}>{repuloUri ? <Image source={{ uri: repuloUri }} style={{ width: 160, height: 210, borderRadius: 6 }} resizeMode="cover" /> : null}</RepuloKep>
      <Fulsor aktiv="fotozas" />
      {feltoltoLap}
    </View>
  );
}

/** Kerek, áttetsző gomb Fluent ikonnal és felirattal a kamera alatt (Galéria, „Fájl, PDF”). */
function KorGomb({ ikon, cim, onPress }: { ikon: 'kep' | 'irat'; cim: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={cim} onPress={onPress} style={({ pressed }) => ({ alignItems: 'center', gap: 8, width: 96, opacity: pressed ? 0.8 : 1 })}>
      <View style={{ width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center' }}>
        <Ikon nev={ikon} pt={30} />
      </View>
      <T m={15} s={650} c="#E4E8F3" kozep>
        {cim}
      </T>
    </Pressable>
  );
}

/** SPEC §26.5: bekötés alatt zárolt képernyő. */
export default function Fotozas() {
  const p = useLocalSearchParams<{ keres?: string }>();
  const vanKeres = !!p.keres;
  return (
    <ZaroltKapu feature="feltoltes" ful="fotozas" cim="Fotózás" vanKeres={vanKeres}>
      <FotozasTartalom />
    </ZaroltKapu>
  );
}
