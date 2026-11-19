// Feltöltött kép előnézete aláírt, rövid életű linkkel (SPEC §12.4 /files/:id/link). MINTA módban a beépített mintakép.
import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, View, type ImageStyle, type StyleProp } from 'react-native';
import { fajlLink } from '../lib/fajlok';
import { szin } from '../theme/tokens';
import { T } from './T';

import { MINTA_KEPEK as MINTAK } from '../api/minta/kepek';

export function FajlKep({ fileId, style, arany = 358 / 254, mod = 'cover' }: { fileId: string; style?: StyleProp<ImageStyle>; arany?: number; mod?: 'cover' | 'contain' }) {
  const [url, setUrl] = useState<string | null>(null);
  const [hiba, setHiba] = useState(false);
  useEffect(() => {
    let el = true;
    fajlLink(fileId)
      .then((u) => el && setUrl(u))
      .catch(() => el && setHiba(true));
    return () => {
      el = false;
    };
  }, [fileId]);
  const minta = url?.startsWith('minta:') ? MINTAK[url.slice(6)] : undefined;
  if (hiba || (url?.startsWith('minta:') && !minta)) {
    return (
      <View style={{ aspectRatio: arany, backgroundColor: '#2E3440', alignItems: 'center', justifyContent: 'center' }}>
        <T m={14.5} c="#C9D2E3">
          {hiba ? 'Most nem tudjuk megmutatni a képet.' : 'Minta: itt látszik a feltöltött kép.'}
        </T>
      </View>
    );
  }
  if (!url) {
    return (
      <View style={{ aspectRatio: arany, backgroundColor: '#2E3440', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={szin.fejlecHalvany} />
      </View>
    );
  }
  return (
    <View style={{ width: '100%', aspectRatio: arany, overflow: 'hidden', backgroundColor: mod === 'contain' ? '#2E3440' : undefined }}>
      <Image source={minta ?? { uri: url }} style={[{ position: 'absolute', left: 0, top: 0, width: '100%', height: '100%' }, style]} resizeMode={mod} accessibilityLabel="A feltöltött irat képe" />
    </View>
  );
}
