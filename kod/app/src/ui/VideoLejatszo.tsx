// Teljes képernyős lejátszó – natív (expo-video, streamelve a /media/ címről; SPEC §26.7.3). Csak a felhasználó
// koppintására indul, nem ismétel; a felirat be van égetve (mindig látszik), külön sávot nem kapcsolunk be (duplán látszana).
// Hiba vagy hiányzó fájl esetén nem törött lejátszó, hanem a „nem érhető el” mondat.
import { useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEventListener } from 'expo';
import { useVideoPlayer, VideoView } from 'expo-video';
import { VIDEO_FILES, type VideoName } from '../_shared/enums';
import { mediaUrl } from '../lib/media';
import { forma, szin } from '../theme/tokens';
import { T } from './T';

export function VideoLejatszo({ nev, cim, bezar, latta }: { nev: VideoName; cim: string; bezar: () => void; latta?: () => void }) {
  const ins = useSafeAreaInsets();
  const [hiba, setHiba] = useState(false);
  const [jelolve, setJelolve] = useState(false);
  const player = useVideoPlayer({ uri: mediaUrl(VIDEO_FILES[nev].mp4), metadata: { title: cim } }, (p) => {
    p.loop = false;
    p.timeUpdateEventInterval = 1;
    p.play();
  });
  useEventListener(player, 'statusChange', ({ status }) => {
    if (status === 'error') setHiba(true);
  });
  useEventListener(player, 'timeUpdate', ({ currentTime }) => {
    if (!jelolve && player.duration > 0 && currentTime / player.duration >= 0.9) {
      setJelolve(true);
      latta?.();
    }
  });
  return (
    <Modal visible animationType="fade" onRequestClose={bezar} supportedOrientations={['portrait']} statusBarTranslucent>
      <View style={{ flex: 1, backgroundColor: '#000', paddingTop: ins.top, paddingBottom: ins.bottom }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, height: 56 }}>
          <T m={16} s={650} c="#fff" style={{ flex: 1 }} numberOfLines={1}>
            {cim}
          </T>
          <Pressable accessibilityRole="button" onPress={bezar} style={{ height: 40, paddingHorizontal: 16, borderRadius: forma.gomb, backgroundColor: 'rgba(255,255,255,0.16)', justifyContent: 'center' }}>
            <T m={15.5} s={650} c="#fff">
              Bezár
            </T>
          </Pressable>
        </View>
        {hiba ? (
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }}>
            <T m={17} lh={1.5} c="#fff" kozep>
              A videó most nem érhető el. Minden lépést leírtunk lent.
            </T>
          </View>
        ) : (
          <VideoView player={player} nativeControls contentFit="contain" fullscreenOptions={{ enable: true }} style={{ flex: 1, backgroundColor: '#000' }} />
        )}
        <View style={{ height: 1, backgroundColor: szin.tintakek }} />
      </View>
    </Modal>
  );
}
