// Képek: a jóváhagyott 3D ikonok (mindig a nagyobb vagy egyenlő pt-méretű fájlból, lefelé méretezve), a rajzolt
// könyvelő, a szemből nézett tárgyképek (160 × 120-as doboz, talajárnyékkal). Vonalas/vektoros ikon NINCS (SPEC §2.6).
import { Image, PixelRatio, Platform, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { IKON3D, TARGYKEPEK, type Ikon3dNev, type TargykepNev } from '../theme/kepjegyzek';
import { szin } from '../theme/tokens';

export type { Ikon3dNev, TargykepNev };

/** A webes export csak az alapfájlt hivatkozza (annak tartalma az @2x): 3×-os kijelzőn (telefon böngészője) ezért a
 *  másfélszer nagyobb pt-méretű fájlt kérjük, hogy a képet mindig csak lefelé méretezzük (TERV A6). Natívan a Metro
 *  maga választ @2x/@3x-at. */
const webSuruseg = () => (Platform.OS === 'web' ? Math.max(1, PixelRatio.get() / 2) : 1);

/** Ikon a dizájnban használt „árnyék nélküli” változattal, ha 44 pt-ig van ilyen (B lap, tokens.css 11-18).
 *  forrasPt: ha az ikont transform nagyítja (fülsor), a NAGYÍTOTT méret – ahhoz választunk forrásfájlt. */
export function Ikon3d({ nev, pt, style, arnyektalan = true, label, forrasPt }: { nev: Ikon3dNev; pt: number; style?: StyleProp<ImageStyle>; arnyektalan?: boolean; label?: string; forrasPt?: number }) {
  let n: Ikon3dNev = nev;
  const at = `${nev}_arnyektalan` as Ikon3dNev;
  if (arnyektalan && pt <= 44 && at in IKON3D) n = at;
  const meretek = IKON3D[n] as Record<number, number>;
  const kulcsok = Object.keys(meretek).map(Number).sort((a, b) => a - b);
  const kell = Math.max(pt, forrasPt ?? 0) * webSuruseg();
  const fajl = kulcsok.find((k) => k >= kell) ?? kulcsok[kulcsok.length - 1];
  return (
    <Image
      source={meretek[fajl]}
      style={[{ width: pt, height: pt }, style]}
      resizeMode="contain"
      accessible={!!label}
      accessibilityLabel={label}
      accessibilityElementsHidden={!label}
      importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}
    />
  );
}

/** A kész-jel: árnyék nélküli, középre tett ibolya pecsét (befizetve_jel). */
export function KeszJel({ pt = 22, label = 'kész' }: { pt?: number; label?: string }) {
  const meretek = IKON3D.befizetve_jel as Record<number, number>;
  const k = [20, 24, 28, 44, 84].find((x) => x >= pt * webSuruseg()) ?? 84;
  return <Image source={meretek[k]} style={{ width: pt, height: pt }} accessibilityLabel={label} />;
}

const AVATAR = require('../../assets/avatar/karakter_1_lapos.png');
// 56 pt fölött (06 Üzenetek: 60 pt) és 3×-os webes kijelzőn a nagy (380 px) forrás: mindig csak lefelé méretezünk.
const AVATAR_NAGY = require('../../assets/avatar/karakter_1_lapos_nagy.png');
/** A könyvelő rajzolt karaktere, kerek. Fehér lapon 1 pt-os hajszálgyűrű (tokens.css 11-18). */
export function Arckep({ pt = 44, gyuru = false, style }: { pt?: number; gyuru?: boolean; style?: StyleProp<ViewStyle> }) {
  const forras = pt * webSuruseg() > 56 ? AVATAR_NAGY : AVATAR;
  return (
    <View
      style={[
        { width: pt, height: pt, borderRadius: pt / 2, backgroundColor: '#E6ECF4', overflow: 'hidden' },
        gyuru ? { borderWidth: 1, borderColor: szin.hajszal } : null,
        style,
      ]}
      accessibilityLabel="A könyvelőd rajzolt képe"
    >
      <Image source={forras} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
    </View>
  );
}

/** A tárgy talajárnyéka: puha radiális ellipszis (tokens.css .targy::after), nem lekerekített szürke csík. */
export function TalajArnyek({ szel, top = 104, sotet = false }: { szel: number; top?: number; sotet?: boolean }) {
  return (
    <Svg width={szel} height={8} style={{ position: 'absolute', left: 80 - szel / 2, top }}>
      <Defs>
        <RadialGradient id="ta" cx="50%" cy="50%" rx="50%" ry="50%">
          <Stop offset="0" stopColor={sotet ? '#000' : '#10153C'} stopOpacity={sotet ? 0.45 : 0.3} />
          <Stop offset="1" stopColor="#10153C" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Ellipse cx={szel / 2} cy={4} rx={szel / 2} ry={4} fill="url(#ta)" />
    </Svg>
  );
}

/** Tárgykép a 160 × 120-as dobozban, alatta a CSS-ből átvett talajárnyék (vékony ellipszis). */
export function Targykep({ nev, arnyek = 100, children, style, sotet = false }: { nev: TargykepNev; arnyek?: number; children?: React.ReactNode; style?: StyleProp<ViewStyle>; sotet?: boolean }) {
  return (
    <View style={[{ width: 160, height: 120, alignSelf: 'center' }, style]} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {arnyek > 0 && <TalajArnyek szel={arnyek} sotet={sotet} />}
      <Image source={TARGYKEPEK[nev]} style={{ position: 'absolute', left: 0, top: 0, width: 160, height: 120 }} resizeMode="contain" />
      {children}
    </View>
  );
}
