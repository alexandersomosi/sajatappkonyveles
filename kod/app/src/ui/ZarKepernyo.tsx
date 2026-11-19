// Biometrikus zár: tintakék sáv a szóvédjeggyel, egyetlen „Feloldás” gomb. A tartalmat teljesen eltakarja.
import { useEffect } from 'react';
import { View } from 'react-native';
import { useAuth } from '../auth/AuthProvider';
import { brand } from '../config';
import { nagybetu, nevelo } from '../lib/format';
import { szin } from '../theme/tokens';
import { Szojegy } from './Szojegy';
import { T } from './T';
import { GombSz } from './alap';
import { Pressable } from 'react-native';

export function ZarKepernyo() {
  const { feloldas, kilep } = useAuth();
  useEffect(() => {
    void feloldas();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <View style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, backgroundColor: szin.tintakek, justifyContent: 'center', paddingHorizontal: 24 }} accessibilityViewIsModal>
      <Szojegy />
      <T m={16.5} c={szin.fejlecHalvany} lh={1.45} style={{ marginTop: 18 }}>
        {nagybetu(nevelo(brand.name))} {brand.name} zárva van, hogy más ne lássa a pénzügyeidet.
      </T>
      <Pressable
        accessibilityRole="button"
        onPress={() => void feloldas()}
        style={{ marginTop: 28, height: 56, borderRadius: 999, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center' }}
      >
        <T m={17} s={650} c={szin.tintakek}>
          Feloldás
        </T>
      </Pressable>
      <GombSz cim="Kilépek, és újra belépek jelszóval" c="#fff" onPress={() => void kilep().catch(() => undefined)} style={{ marginTop: 12, alignSelf: 'center' }} />
    </View>
  );
}
