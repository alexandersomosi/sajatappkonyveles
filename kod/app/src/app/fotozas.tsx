// 09 Fotózás (FUNKCIOK 13): natívan iratszkenner (automatikus élkeresés, kiegyenesítés, több oldal: Android ML Kit /
// iOS VisionKit); ha nincs (web, Expo Go): kamera sarokjelekkel, vagy fájlválasztás. Átnézés: oldalcsík, „Ezt újra”,
// „+” újabb oldal, „Kész, feltöltöm” → kategória és hónap → feltöltés folyamatjelzéssel.
import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, Platform, Pressable, TurboModuleRegistry, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useHome, useKeresek, useKeresKesz } from '@/api/hooks';
import { MINTA_MOD } from '@/config';
import { iratFeltolt, type HelyiFajl } from '@/lib/fajlok';
import { mozgasKi } from '@/lib/mozgas';
import { szin } from '@/theme/tokens';
import { Arckep, Ikon3d, KeszJel } from '@/ui/kepek';
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
    <Pressable accessibilityRole="button" onPress={onPress} style={{ height: 40, paddingHorizontal: 14, borderRadius: 999, backgroundColor: 'rgba(15,27,51,0.55)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.16)', justifyContent: 'center' }}>
      <T m={15} s={600} c="#fff" ls={-0.005}>
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
      setMod('atnez');
    } catch {
      jelez('Nem sikerült a fotó. Próbáld újra.');
    }
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
      const irat = await iratFeltolt({ lapok, kategoria, honap, megjegyzes, cim, keresId: p.keres, folyamat: setFolyamat });
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

  return (
    <View style={{ flex: 1, backgroundColor: szin.kamera }}>
      {/* kép / kamera */}
      <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 208, backgroundColor: '#1D2532' }}>
        {mod === 'kamera' && Platform.OS !== 'web' && engedely?.granted ? (
          <CameraView ref={kamera} style={{ flex: 1 }} facing="back" flash={vaku} />
        ) : null}
        {mod === 'kamera' && (Platform.OS === 'web' || !engedely?.granted) ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32, gap: 14 }}>
            <Ikon3d nev="fotozas" pt={56} />
            <T m={16} c="#C9D2E3" kozep lh={1.5}>
              {Platform.OS === 'web' ? 'A böngészőben a telefonod kamerája vagy a galériád nyílik meg.' : 'A fotózáshoz engedélyezd a kamerát.'}
            </T>
            <Pressable
              accessibilityRole="button"
              onPress={() => (Platform.OS === 'web' ? void galeria() : void kerEngedely())}
              style={{ height: 50, paddingHorizontal: 22, borderRadius: 999, backgroundColor: '#fff', justifyContent: 'center' }}
            >
              <T m={16.5} s={650} c={szin.tintakek}>
                {Platform.OS === 'web' ? 'Fotó vagy kép kiválasztása' : 'Engedélyezem a kamerát'}
              </T>
            </Pressable>
          </View>
        ) : null}
        {mod === 'atnez' && aktivLap ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }} onLayout={(e) => setTerulet({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}>
            {/* A sarokjelek a papír saját sarkain ülnek: a doboz pontosan a kép arányát kapja (nem doboz a dobozban). */}
            {terulet ? (
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
            ) : null}
          </View>
        ) : null}
        {mod === 'kamera' && Platform.OS !== 'web' && engedely?.granted ? (
          <View pointerEvents="none" style={{ position: 'absolute', left: '9%', right: '9%', top: '24%', bottom: '18%' }}>
            <Sarkok szin="rgba(255,255,255,0.85)" />
          </View>
        ) : null}
      </View>

      {/* felső sor: Mégse · {firstName} kapja meg · Vaku */}
      <View style={{ position: 'absolute', top: felul + 4, left: 16, right: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Kerek cim="Mégse" onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 4 }}>
          <View style={{ borderRadius: 15, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.55)' }}>
            <Arckep pt={28} />
          </View>
          <T m={14.5} s={600} c="#fff" style={{ textShadowColor: 'rgba(0,0,0,0.55)', textShadowRadius: 6, textShadowOffset: { width: 0, height: 1 } }} numberOfLines={1}>
            {fn} kapja meg
          </T>
        </View>
        {Platform.OS !== 'web' ? <Kerek cim={`Vaku: ${vaku === 'auto' ? 'auto' : vaku === 'on' ? 'be' : 'ki'}`} onPress={() => setVaku((v) => (v === 'auto' ? 'on' : v === 'on' ? 'off' : 'auto'))} /> : <View style={{ width: 40 }} />}
      </View>

      {mod === 'atnez' ? (
        <View style={{ position: 'absolute', top: felul + 84, left: 0, right: 0, alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, height: 36, paddingLeft: 10, paddingRight: 14, borderRadius: 8, backgroundColor: '#fff' }}>
            <KeszJel pt={22} />
            <T m={15} s={650}>
              {kesz ? 'Feltöltve' : lapok.length > 1 ? `${lapok.length} oldal hozzáadva` : 'Hozzáadva. Nézd meg, olvasható-e.'}
            </T>
          </View>
        </View>
      ) : null}
      {mod === 'atnez' && lapok.length ? (
        <View style={{ position: 'absolute', bottom: 222, left: 0, right: 0, alignItems: 'center' }}>
          <View style={{ height: 30, paddingHorizontal: 11, borderRadius: 8, backgroundColor: 'rgba(15,27,51,0.62)', justifyContent: 'center' }}>
            <T m={14} s={600} c="#fff">
              {aktiv + 1}. oldal
            </T>
          </View>
        </View>
      ) : null}

      {/* alsó panel */}
      <View style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 208 + (Platform.OS === 'web' ? 0 : ins.bottom), backgroundColor: szin.kamera, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 16, paddingHorizontal: 16 }}>
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
              style={{ width: 46, height: 58, borderRadius: 8, overflow: 'hidden', backgroundColor: '#2A3039', borderWidth: i === aktiv ? 2 : 0, borderColor: '#fff' }}
            >
              <Image source={mintaForras ?? { uri: l.uri }} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
              <View style={{ position: 'absolute', left: 4, bottom: 4, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: szin.kamera, alignItems: 'center', justifyContent: 'center' }}>
                <T m={11} s={700} c="#fff" lh={1}>
                  {i + 1}
                </T>
              </View>
            </Pressable>
          ))}
          {lapok.length < 20 ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Még egy oldal" onPress={() => void hozzaad()} style={{ width: 46, height: 58, borderRadius: 8, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}>
              <Ikon3d nev="fotozas" pt={32} />
            </Pressable>
          ) : null}
          <View style={{ flex: 1, marginLeft: 4 }}>
            <T m={15.5} s={650} c="#fff" lh={1.35}>
              {lapok.length ? `${lapok.length} oldal` : 'Még nincs oldal'}
            </T>
            <T m={14.5} c="#C9D2E3" lh={1.35}>
              {lapok.length ? 'Ha van még lap, fotózd hozzá.' : 'Tedd az iratot sötét alapra, és fotózd le.'}
            </T>
          </View>
        </View>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
          {mod === 'atnez' ? (
            <Pressable accessibilityRole="button" onPress={ujra} style={{ height: 56, paddingHorizontal: 22, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', justifyContent: 'center' }}>
              <T m={17} s={650} c="#fff">
                Ezt újra
              </T>
            </Pressable>
          ) : Platform.OS !== 'web' && engedely?.granted ? (
            <Pressable accessibilityRole="button" onPress={() => void galeria()} style={{ height: 56, paddingHorizontal: 22, borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.14)', justifyContent: 'center' }}>
              <T m={17} s={650} c="#fff">
                Galéria
              </T>
            </Pressable>
          ) : null}
          {mod === 'kamera' && Platform.OS !== 'web' && engedely?.granted ? (
            <Pressable accessibilityRole="button" accessibilityLabel="Fénykép készítése" onPress={() => void fenykep()} style={{ flex: 1, height: 56, borderRadius: 999, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 }}>
              <Ikon3d nev="fotozas" pt={27} />
              <T m={17} s={650} c={szin.tintakek}>
                Fotó
              </T>
            </Pressable>
          ) : (
            <Pressable
              accessibilityRole="button"
              disabled={!lapok.length || kesz}
              onPress={() => setLap(true)}
              style={{ flex: 1, height: 56, borderRadius: 999, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, opacity: lapok.length ? 1 : 0.5 }}
            >
              <Ikon3d nev="feltoltes" pt={27} style={{ marginLeft: -4 }} />
              <T m={17} s={650} c={szin.tintakek}>
                Kész, feltöltöm
              </T>
            </Pressable>
          )}
        </View>
      </View>
      <FeltoltesLap
        lathato={lap}
        bezar={() => setLap(false)}
        kezdoKategoria={p.kategoria ?? 'nyugta'}
        kezdoHonap={p.honap}
        oldalak={lapok.length}
        folyamat={folyamat}
        kuld={feltolt}
        hiba={feltoltesHiba}
      />
    </View>
  );
}

/** SPEC §26.5: bekötés alatt zárolt képernyő. */
export default function Fotozas() {
  const p = useLocalSearchParams<{ keres?: string }>();
  const vanKeres = !!p.keres;
  return (
    <ZaroltKapu feature="feltoltes" ful="fooldal" cim="Fotózás" vanKeres={vanKeres}>
      <FotozasTartalom />
    </ZaroltKapu>
  );
}
