// Teljes képernyős lejátszó – web (<video controls playsinline preload="none"> + magyar felirat-sáv;
// SPEC §26.7.3; a felirat be van égetve, a sáv választható). A felhasználó koppintására indul, nem ismétel; hiba vagy
// hiányzó fájl esetén a „nem érhető el” mondat.
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, View } from 'react-native';
import { VIDEO_FILES, type VideoName } from '../_shared/enums';
import { mediaUrl } from '../lib/media';
import { forma } from '../theme/tokens';
import { T } from './T';

export function VideoLejatszo({ nev, cim, bezar, latta }: { nev: VideoName; cim: string; bezar: () => void; latta?: () => void }) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [hiba, setHiba] = useState(false);
  const jelolve = useRef(false);
  const f = VIDEO_FILES[nev];
  useEffect(() => {
    const v = ref.current;
    if (!v) return;
    // A koppintás után indítjuk (felhasználói művelet); ha a böngésző mégsem engedi, a vezérlőkkel indítható.
    void v.play().catch(() => undefined);
    // A felirat be van égetve a videóba (mindig látszik); a VTT-sáv választható marad, de alapból NEM kapcsoljuk be,
    // különben minden felirat kétszer látszana (SPEC §24 11-18 videósok javaslata, app).
  }, []);
  return (
    <Modal visible transparent={false} animationType="fade" onRequestClose={bezar}>
      <View style={{ flex: 1, backgroundColor: '#000' }}>
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
          <View style={{ flex: 1 }}>
            <video
              ref={ref}
              controls
              playsInline
              preload="none"
              poster={mediaUrl(f.poster)}
              title={cim}
              aria-label={cim}
              style={{ width: '100%', height: '100%', objectFit: 'contain', backgroundColor: '#000' }}
              onError={() => setHiba(true)}
              onTimeUpdate={(e) => {
                const v = e.currentTarget;
                if (!jelolve.current && v.duration > 0 && v.currentTime / v.duration >= 0.9) {
                  jelolve.current = true;
                  latta?.();
                }
              }}
            >
              <source src={mediaUrl(f.mp4)} type="video/mp4" onError={() => setHiba(true)} />
              <track kind="captions" srcLang="hu" label="Magyar" src={mediaUrl(f.vtt)} />
            </video>
          </View>
        )}
      </View>
    </Modal>
  );
}
