// Videókártya (SPEC §26.7.3): FEHÉR lap (18 pt) a sáv alatt – balra a plakát bélyegképe hajszálgyűrűvel, mellette a
// hossz, a cím és a „Lejátszás” kapszula alakként rajzolt, kitöltött háromszöggel (nem ikonkészlet; mögötte nincs
// korong). Kék csak a kapszula: a kártya nem olvadhat össze a kék sávval (dizájn-ellenőrzés, 11-19).
// Koppintásra teljes képernyős lejátszó (hang be, nincs automatikus indítás, nincs ismétlés). Ha a fájl nincs meg vagy
// nincs net: plakát (vagy a boríték tárgykép) + „A videó most nem érhető el…”. Nincs mérés, nincs követés.
import { useEffect, useState } from 'react';
import { Image, Pressable, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import Svg, { Path } from 'react-native-svg';
import type { VideoManifest } from '../_shared/api';
import { VIDEO_FILES, VIDEO_MANIFEST_FILE, type VideoName } from '../_shared/enums';
import { NBSP, videoHossz } from '../lib/format';
import { mediaUrl } from '../lib/media';
import { beallitasIr, beallitasOlvas } from '../lib/tarolo';
import { forma, szin } from '../theme/tokens';
import { Lap } from './alap';
import { Targykep } from './kepek';
import { T } from './T';
import { VideoLejatszo } from './VideoLejatszo';

export const NEM_ELERHETO = 'A videó most nem érhető el. Minden lépést leírtunk lent.';

/** Kitöltött háromszög (alak, nem ikonkészlet). */
export function Haromszog({ meret = 14, szinKod = szin.tintakek }: { meret?: number; szinKod?: string }) {
  return (
    <Svg width={meret} height={meret} viewBox="0 0 14 14" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Path d="M3 1.6 L12.4 7 L3 12.4 Z" fill={szinKod} />
    </Svg>
  );
}

const hossz = videoHossz;

/** Elérhető-e a videó (HEAD). Hálózati hiba = nem (offline szöveg). */
export function useVideoElerheto(nev: VideoName) {
  return useQuery({
    queryKey: ['videoVan', nev],
    queryFn: async () => {
      try {
        const r = await fetch(mediaUrl(VIDEO_FILES[nev].mp4), { method: 'HEAD', cache: 'no-cache' });
        return r.ok && !(r.headers.get('content-type') ?? '').includes('text/html');
      } catch {
        return false;
      }
    },
    staleTime: 10 * 60_000,
    retry: 0,
  });
}
function useVideoHossz(nev: VideoName) {
  return useQuery({
    queryKey: ['videok'],
    queryFn: async () => {
      const r = await fetch(mediaUrl(VIDEO_MANIFEST_FILE), { cache: 'no-cache' });
      if (!r.ok) return null;
      return (await r.json()) as VideoManifest;
    },
    staleTime: 3600_000,
    retry: 0,
    select: (m) => {
      const x = m?.items.find((i) => i.name === nev);
      return { mp: x?.durationSec, hang: x?.hasNarration !== false };
    },
  });
}

/** Megnézte-e már ≥ 90%-ig (helyi jelző, felhasználónként). */
export function useLatta(nev: VideoName, userId?: string) {
  const kulcs = `kj_video_${nev}_${userId ?? 'x'}`;
  const [latta, setLatta] = useState(false);
  useEffect(() => {
    void beallitasOlvas(kulcs).then((v) => setLatta(v === '1'));
  }, [kulcs]);
  return { latta, jelol: () => void beallitasIr(kulcs, '1').then(() => setLatta(true)) };
}

/** A lejátszás kapszulája: az egyetlen kék elem a fehér kártyán (a háromszög alak, nem ikon). */
function LejatszasKapszula({ style }: { style?: StyleProp<ViewStyle> }) {
  return (
    <View style={[{ flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-start', height: 44, paddingLeft: 15, paddingRight: 19, borderRadius: forma.gomb, backgroundColor: szin.tintakek }, style]}>
      <Haromszog meret={14} szinKod="#fff" />
      <T m={16} s={650} c="#fff" ls={-0.005} numberOfLines={1}>
        Lejátszás
      </T>
    </View>
  );
}

export function VideoKartya({
  nev,
  cim,
  magas = 180,
  osszecsukva = false,
  kompakt = false,
  rovidCim = 'Bemutató videó',
  latta,
  style,
}: {
  nev: VideoName;
  cim: string;
  /** The collapsed row's short label (SPEC §26.7.3: "▶ Bemutató videó · 1:35"); the length is never cut off. */
  rovidCim?: string;
  magas?: number;
  /** Egy sorba csukva („Bemutató videó · 1:35”), koppintásra kinyílik. */
  osszecsukva?: boolean;
  /** Alacsony (~104 pt) változat: kis bélyegkép, cím, jobbra a kapszula – amíg az első képernyőn más a fő kérdés. */
  kompakt?: boolean;
  latta?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const van = useVideoElerheto(nev);
  const mp = useVideoHossz(nev);
  const [nyitva, setNyitva] = useState(false);
  const [kinyitva, setKinyitva] = useState(false);
  const [poszterHiba, setPoszterHiba] = useState(false);
  const keskeny = Math.min(useWindowDimensions().width, 480) < 360;
  const nincs = van.data === false;
  const h = hossz(mp.data?.mp ?? undefined);
  // videok.json: hasNarration false = the silent captioned interim; never promise sound then.
  const hang = mp.data?.hang ?? true;

  if (osszecsukva && !kinyitva) {
    return (
      <Lap style={style}>
        <Pressable accessibilityRole="button" accessibilityLabel={`${cim}${h ? `, ${h}` : ''}. Kinyitom`} onPress={() => setKinyitva(true)} style={({ pressed }) => [{ flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 52, paddingVertical: 8, paddingHorizontal: 16 }, pressed && { backgroundColor: '#F6F8FB' }]}>
          {/* csak a kitöltött háromszög – ikon mögé nem kerül pasztell korong (TERV 0., SPEC §26.0) */}
          <Haromszog meret={15} />
          {/* 320 pt-on is elfér: rövidebb felirat, a „· 1:38” nem törhet el, és két sor is megengedett */}
          <T m={16} s={600} lh={1.3} style={{ flex: 1, minWidth: 0 }}>
            {keskeny ? 'Videó' : rovidCim}
            {h ? (
              <T m={16} s={400} c={szin.halvany} szam>
                {`${NBSP}·${NBSP}${h}`}
              </T>
            ) : null}
          </T>
          <T m={14.5} s={600} c={szin.tintakekSzoveg} alahuz>
            Kinyitom
          </T>
        </Pressable>
      </Lap>
    );
  }

  // A plakát álló (9:16): egészben, bélyegképként áll a fehér lap bal szélén, 1 pt-os hajszálgyűrűvel.
  const kicsi = kompakt && !kinyitva;
  const posztMag = kicsi ? 80 : magas - 24;
  const posztSzel = Math.round((posztMag * 9) / 16);
  const belyeg = (
    <View style={{ width: posztSzel, height: posztMag, borderRadius: kicsi ? 8 : 12, overflow: 'hidden', backgroundColor: szin.alap, borderWidth: 1, borderColor: szin.hajszal, alignItems: 'center', justifyContent: 'center' }}>
      {!poszterHiba ? (
        <Image source={{ uri: mediaUrl(VIDEO_FILES[nev].poster) }} onError={() => setPoszterHiba(true)} style={{ width: '100%', height: '100%' }} resizeMode="cover" accessibilityElementsHidden />
      ) : nincs && !kicsi ? (
        <Targykep nev="level_boritek" style={{ transform: [{ scale: 0.62 }] }} />
      ) : (
        <Haromszog meret={kicsi ? 18 : 28} />
      )}
    </View>
  );
  return (
    <Lap style={style}>
      {nincs ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12 }} accessibilityLiveRegion="polite">
          {belyeg}
          <View style={{ flex: 1 }}>
            <T m={17} s={650} lh={1.35}>
              {cim}
            </T>
            <T m={15.5} lh={1.45} c={szin.halvany} style={{ marginTop: 4 }}>
              {NEM_ELERHETO}
            </T>
          </View>
        </View>
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`${cim}${h ? `, ${h}` : ''}. Lejátszás`}
          onPress={() => setNyitva(true)}
          style={({ pressed }) => ({ minHeight: kicsi ? undefined : magas, flexDirection: 'row', alignItems: 'center', gap: kicsi ? 12 : 16, padding: 12, backgroundColor: pressed ? '#F6F8FB' : szin.lap })}
        >
          {belyeg}
          <View style={{ flex: 1, minWidth: 0 }}>
            <T m={13} s={700} ls={0.06} c={szin.halvany}>
              {h ? `VIDEÓ · ${h}` : 'VIDEÓ'}
            </T>
            <T m={kicsi ? 17 : 19} s={700} lh={1.25} ls={-0.015} style={{ marginTop: 2 }}>
              {cim}
            </T>
            {kicsi ? null : (
              <>
                <T m={14} lh={1.4} c={szin.halvany} style={{ marginTop: 3 }}>
                  {hang ? 'Felirattal, hanggal.' : 'Felirattal.'}
                </T>
                <LejatszasKapszula style={{ marginTop: 12 }} />
              </>
            )}
          </View>
          {kicsi ? <LejatszasKapszula style={{ alignSelf: 'center' }} /> : null}
        </Pressable>
      )}
      {nyitva ? <VideoLejatszo nev={nev} cim={cim} bezar={() => setNyitva(false)} latta={latta} /> : null}
    </Lap>
  );
}
