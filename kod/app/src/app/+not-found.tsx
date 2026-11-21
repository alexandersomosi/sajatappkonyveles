// Ismeretlen cím: magyar, v2 stílusú oldal (kék fejléc a logóval, fehér kártya) (Expo Router alap angol oldala és a Sitemap link helyett).
import { router } from 'expo-router';
import { View } from 'react-native';
import { szin } from '@/theme/tokens';
import { Fejlec, GombE, Lap } from '@/ui/alap';
import { Targykep } from '@/ui/kepek';
import { Kepernyo } from '@/ui/keret';
import { T } from '@/ui/T';

export default function NincsIlyenOldal() {
  return (
    <Kepernyo fejlec={<Fejlec alsoTer={18} />}>
      <Lap style={{ paddingTop: 22, paddingHorizontal: 22, paddingBottom: 22, alignItems: 'center' }}>
        <Targykep nev="ures_mappa" style={{ marginBottom: 12 }} />
        <T m={22} s={700} lh={1.25} ls={-0.02} kozep accessibilityRole="header">
          Ezt az oldalt nem találjuk
        </T>
        <T m={16} lh={1.5} c={szin.halvany} kozep style={{ marginTop: 6, marginBottom: 18, maxWidth: 300 }}>
          Lehet, hogy elírás van a címben, vagy az oldal már nincs meg.
        </T>
        <View style={{ alignSelf: 'stretch' }}>
          <GombE cim="Vissza a főoldalra" onPress={() => router.replace('/')} />
        </View>
      </Lap>
    </Kepernyo>
  );
}
