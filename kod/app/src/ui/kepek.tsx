// Képek – v2 (k8, tulaj 11-20): a tartalmi ikonok Microsoft Fluent Emoji Flat rajzok (MIT), a kezelőelemek Material
// ikonok (Apache-2.0) – a közös v2 alapból (src/_shared/v2, a kod/shared/v2 másolata). A régi 3D ikonok/tárgyképek
// nevei maradnak (Ikon3dNev, TargykepNev: theme/kepjegyzek.ts – csak a típusukat használjuk, a PNG-ket a bundler már nem
// viszi), belül a megfeleltetés (IKON3D_UJ, TARGYKEP_UJ) rajzolja az új ikont. A régi változat: _regi/elotte_k8_A/src/ui/kepek.tsx.
import { Image, PixelRatio, Platform, View, type ImageStyle, type StyleProp, type ViewStyle } from 'react-native';
import type { Ikon3dNev, TargykepNev } from '../theme/kepjegyzek';
import { Csempe, EMOJI_ADAT, Ikon, IKON3D_UJ, TARGYKEP_UJ, VezerloIkon, type EmojiNev, type RegiIkonNev } from '../_shared/v2/rn';
import { szin } from '../theme/tokens';

export type { Ikon3dNev, TargykepNev };
/** Régi 3D ikonnév VAGY közvetlenül egy v2 (Fluent) emoji-név – az új kód a pontosabb emoji-nevet adhatja. */
export type IkonNev = Ikon3dNev | EmojiNev;

/** Név → új ikon: a régi nevek a megfeleltetésen át, az emoji-nevek közvetlenül. */
export function ujIkon(nev: IkonNev): { fajta: 'emoji'; nev: EmojiNev } | { fajta: 'vezerlo'; nev: Parameters<typeof VezerloIkon>[0]['nev'] } {
  const regi = IKON3D_UJ[nev as RegiIkonNev];
  if (regi) return regi as never;
  return { fajta: 'emoji', nev: (nev in EMOJI_ADAT ? nev : 'irat') as EmojiNev };
}

/** A webes export csak az alapfájlt hivatkozza: 3×-os kijelzőn a nagyobb avatarfájlt kérjük (csak lefelé méretezünk). */
const webSuruseg = () => (Platform.OS === 'web' ? Math.max(1, PixelRatio.get() / 2) : 1);

/** Régi ikonnév → az új (emoji vagy vezérlő) ikon. A `style` (pl. margó, transform) a dobozra kerül. */
export function Ikon3d({ nev, pt, style, label }: { nev: IkonNev; pt: number; style?: StyleProp<ImageStyle>; arnyektalan?: boolean; label?: string; forrasPt?: number }) {
  const uj = ujIkon(nev);
  const st = style as StyleProp<ViewStyle>;
  return uj.fajta === 'emoji' ? <Ikon nev={uj.nev} pt={pt} label={label} style={st} /> : <VezerloIkon nev={uj.nev} pt={pt} szin={szin.tintakek} label={label} style={st} />;
}

/** Az új emoji-név közvetlenül (új kódban ezt használd). */
export function EIkon({ nev, pt = 34, label, style }: { nev: EmojiNev; pt?: number; label?: string; style?: StyleProp<ViewStyle> }) {
  return <Ikon nev={nev} pt={pt} label={label} style={style} />;
}

/** A kész-jel: zöld pipa (Fluent „pipa-kor”). A felolvasó „kész”-nek olvassa (üres címkével díszítés). */
export function KeszJel({ pt = 22, label = 'kész' }: { pt?: number; label?: string }) {
  return <Ikon nev="pipa-kor" pt={pt} label={label || undefined} />;
}

const AVATAR = require('../../assets/avatar/karakter_1_lapos.png');
// 56 pt fölött (06 Üzenetek: 60 pt) és 3×-os webes kijelzőn a nagy (380 px) forrás: mindig csak lefelé méretezünk.
const AVATAR_NAGY = require('../../assets/avatar/karakter_1_lapos_nagy.png');
/** A könyvelő rajzolt karaktere, kerek. `gyuru`: fehér lapon hajszálgyűrű; a kék fejlécen a hívó ad fehér gyűrűt. */
export function Arckep({ pt = 44, gyuru = false, style }: { pt?: number; gyuru?: boolean; style?: StyleProp<ViewStyle> }) {
  const forras = pt * webSuruseg() > 56 ? AVATAR_NAGY : AVATAR;
  return (
    <View
      style={[
        { width: pt, height: pt, borderRadius: pt / 2, backgroundColor: '#fff', overflow: 'hidden' },
        gyuru ? { borderWidth: 1, borderColor: szin.hajszal } : null,
        style,
      ]}
      accessibilityLabel="A könyvelőd rajzolt képe"
    >
      <Image source={forras} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
    </View>
  );
}

/** @deprecated v2: nincs talajárnyék (lapos ikonok). Üres, a hívók miatt marad. */
export function TalajArnyek(_: { szel: number; top?: number; sotet?: boolean }) {
  return null;
}

/** Üres állapot / illusztráció: a régi 160 × 120-as tárgykép helyett a v2 nagy csempéje (64, 50-es ikon) középen. */
export function Targykep({ nev, children, style }: { nev: TargykepNev; arnyek?: number; children?: React.ReactNode; style?: StyleProp<ViewStyle>; sotet?: boolean }) {
  const uj = TARGYKEP_UJ[nev as keyof typeof TARGYKEP_UJ] ?? 'dosszie';
  return (
    <View style={[{ alignSelf: 'center', alignItems: 'center', justifyContent: 'center', paddingTop: 6 }, style, { width: undefined, height: undefined }]} aria-hidden>
      <Csempe nev={uj} meret="nagy" />
      {children}
    </View>
  );
}
