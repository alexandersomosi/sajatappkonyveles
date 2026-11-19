// A foglalt hívás tépőnaptára („NOV. 19. / 14:00”) – a Bekötés kártyáján és az Időpont képernyőn ugyanaz (dizájn 02).
import { Image, View } from 'react-native';
import { HONAPOK_ROVID, ido, reszek } from '../lib/format';
import { T } from '../ui/T';
import { TalajArnyek } from '../ui/kepek';

const TEPONAPTAR = require('../../assets/illusztraciok/tepnaptar_3d.png');

export function TepoNaptar({ startsAt }: { startsAt: string }) {
  const r = reszek(startsAt);
  return (
    <View style={{ width: 160, height: 120, alignSelf: 'center', marginBottom: 4 }} accessible accessibilityLabel={`${HONAPOK_ROVID[r.honap - 1]} ${r.nap}., ${ido(r)}`}>
      <TalajArnyek szel={84} />
      <Image source={TEPONAPTAR} style={{ position: 'absolute', left: 40.5, top: 12, width: 79, height: 96 }} resizeMode="contain" />
      <T m={10.5} s={750} ls={0.1} c="#3A4256" kozep lh={1} style={{ position: 'absolute', top: 52, left: 0, width: 160 }}>
        {`${HONAPOK_ROVID[r.honap - 1].replace('.', '').toUpperCase()}. ${r.nap}.`}
      </T>
      <T m={23} s={800} ls={-0.035} kozep lh={1} szam style={{ position: 'absolute', top: 66, left: 0, width: 160 }}>
        {ido(r)}
      </T>
    </View>
  );
}
