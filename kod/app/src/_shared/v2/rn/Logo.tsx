// GENERATED from kod/shared/v2 – do not edit here. Edit kod/shared/v2 and re-run sync-v2.
// Adózz.hu v2 – a felirat-logó React Native-ben (kép, így az appba nem kell a Poppins betű).
// Egyetlen 4×-es kép (logo/logo.png, logo/logo_feher.png) pontos mérettel: natívan a rendszer kicsinyíti, és az Expo
// webes exportja is ugyanezt a fájlt hivatkozza (ott a @2x/@3x változatokat nem választaná ki) – így mindenhol éles.
import { memo } from 'react';
import { Image, type ImageStyle, type StyleProp } from 'react-native';
import { LOGO_ALT, logoMeret } from '../logo/meret';

const KEK = require('../logo/logo.png');
const FEHER = require('../logo/logo_feher.png');

export interface LogoProps {
  /** Betűméret px-ben, mint a v2.js `data-meret` (alap: 30). */
  meret?: number;
  /** Fehér felirat sárga „zz”-vel – a kék fejlécre. Alap: kék felirat fehér/szürke alapra. */
  feher?: boolean;
  /** Felolvasói név (alap: „Adózz.hu”); üres szöveggel díszítés (ha mellette ki van írva a név). */
  label?: string;
  style?: StyleProp<ImageStyle>;
}

function LogoAlap({ meret = 30, feher = false, label = LOGO_ALT, style }: LogoProps) {
  const m = logoMeret(meret, feher);
  return (
    <Image
      source={feher ? FEHER : KEK}
      style={[{ width: m.width, height: m.height }, style]}
      resizeMode="contain"
      {...(label ? { accessible: true, role: 'img' as const, 'aria-label': label, alt: label } : { accessible: false, 'aria-hidden': true })}
    />
  );
}

export const Logo = memo(LogoAlap);
