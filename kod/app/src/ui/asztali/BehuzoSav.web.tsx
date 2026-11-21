// k8 gépes nézet (web): a feltöltő sáv fájl-behúzással (drag & drop). Behúzáskor a sáv kivilágosodik (világoskék fedőréteg,
// 200 ms – mozgás #12; csökkentett mozgásnál azonnal). A natív párja (BehuzoSav.tsx) csak a gyerekeket rajzolja.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, View, type StyleProp, type ViewStyle } from 'react-native';
import type { HelyiFajl } from '../../lib/fajlok';
import { MOZGAS_IDO, useMozgasKi } from '../../lib/mozgas';
import { szin } from '../../theme/tokens';

export function fajlbolHelyi(f: File): HelyiFajl {
  const mime = f.type || (f.name.toLowerCase().endsWith('.pdf') ? 'application/pdf' : 'image/jpeg');
  return { uri: URL.createObjectURL(f), nev: f.name, mime, meret: f.size, webFajl: f };
}

export function BehuzoSav({ onFajlok, children, style }: { onFajlok: (f: HelyiFajl[]) => void; children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const ref = useRef<unknown>(null);
  const [folott, setFolott] = useState(false);
  const ki = useMozgasKi();
  const o = useRef(new Animated.Value(0)).current;
  const hivo = useRef(onFajlok);
  hivo.current = onFajlok;
  useEffect(() => {
    Animated.timing(o, { toValue: folott ? 1 : 0, duration: ki ? 0 : MOZGAS_IDO.behuzas, useNativeDriver: false }).start();
  }, [folott, ki, o]);
  useEffect(() => {
    const el = ref.current as HTMLElement | null;
    if (!el?.addEventListener) return;
    let melyseg = 0;
    const be = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      e.preventDefault();
      melyseg++;
      setFolott(true);
    };
    const felett = (e: DragEvent) => {
      if (!e.dataTransfer?.types?.includes('Files')) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    };
    const ki2 = () => {
      melyseg = Math.max(0, melyseg - 1);
      if (!melyseg) setFolott(false);
    };
    const ejt = (e: DragEvent) => {
      e.preventDefault();
      melyseg = 0;
      setFolott(false);
      const lista = Array.from(e.dataTransfer?.files ?? []);
      if (lista.length) hivo.current(lista.map(fajlbolHelyi));
    };
    el.addEventListener('dragenter', be);
    el.addEventListener('dragover', felett);
    el.addEventListener('dragleave', ki2);
    el.addEventListener('drop', ejt);
    return () => {
      el.removeEventListener('dragenter', be);
      el.removeEventListener('dragover', felett);
      el.removeEventListener('dragleave', ki2);
      el.removeEventListener('drop', ejt);
    };
  }, []);
  return (
    <View
      ref={ref as never}
      style={[{ borderWidth: 2, borderStyle: 'dashed', borderColor: folott ? szin.tintakek : szin.feltoltoKeret, borderRadius: 18, backgroundColor: '#fff', overflow: 'hidden' }, style]}
    >
      <Animated.View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: szin.kekVil, opacity: o }} />
      {children}
    </View>
  );
}
