// Adózz.hu v2 – régi 3D ikon- és tárgykép-nevek → új ikon (ALAP-D / D5).
// Ezzel áll át egy csapásra a 86 app-beli `<Ikon3d>` és a 183 panelbeli `<I3>` hívás: a régi komponens aláírása marad,
// belül a v2 `Ikon` / `Csempe` rajzol ezen a táblázaton át (FELÜLET-A: A0, FELÜLET-P: P1).
// Forrás-kulcslisták (csak olvasva): kod/app/src/theme/kepjegyzek.ts (`Ikon3dNev`, `TargykepNev`),
// kod/panel/src/ui/Icon3d.tsx (`Icon3dName`). A teszt (teszt/v2.test.mjs) ellenőrzi, hogy minden régi név le van fedve.
import type { EmojiNev } from './emoji-adat';
import type { VezerloNev } from './material';

/** Az új ikon: tartalmi (színes emoji) vagy vezérlő (egyszínű Material). */
export type UjIkon = { readonly fajta: 'emoji'; readonly nev: EmojiNev } | { readonly fajta: 'vezerlo'; readonly nev: VezerloNev };

const e = (nev: EmojiNev): UjIkon => ({ fajta: 'emoji', nev });
const v = (nev: VezerloNev): UjIkon => ({ fajta: 'vezerlo', nev });

/** App `Ikon3dNev` és panel `Icon3dName` → új ikon. Az `_arnyektalan` és `_jel` változatok ugyanarra mennek
 *  (az új ikonnak nincs árnyéka). A „masolas” vezérlő lett (a „Másolom” gombok ikonja). */
export const IKON3D_UJ = {
  befizetve: e('pipa-kor'),
  befizetve_arnyektalan: e('pipa-kor'),
  befizetve_jel: e('pipa-kor'),
  bevallas: e('irat-toll'),
  boritek: e('level'),
  dosszie: e('dosszie'),
  ertesites: e('csengo'),
  ertesites_arnyektalan: e('csengo'),
  feltoltes: e('feltolt'),
  fiok: e('fiok'),
  fooldal: e('fooldal'),
  fotozas: e('kamera'),
  fotozas_arnyektalan: e('kamera'),
  hataridok: e('naptar'),
  igazolas: e('igazolvany'),
  irat: e('irat'),
  irat_arnyektalan: e('irat'),
  kerdezek: e('buborek'),
  kivonat: e('bank'),
  lakat: e('lakat'),
  masolas: v('masol'),
  masolas_arnyektalan: v('masol'),
  nyugta: e('nyugta'),
  nyugta_arnyektalan: e('nyugta'),
  nyugta_uj: e('nyugta'),
  ora: e('ora'),
  szamlak: e('nyugta'),
  szamlaszam: e('bank'),
  szamlaszam_arnyektalan: e('bank'),
  szamolo: e('szamologep'),
  szamolo_arnyektalan: e('szamologep'),
  tepnaptar: e('naptar'),
  uzenetek: e('uzenet'),
} as const satisfies Readonly<Record<string, UjIkon>>;

export type RegiIkonNev = keyof typeof IKON3D_UJ;

/** App `TargykepNev` (nagy 3D tárgyképek, 120–160 pt) → nagy csempe + emoji. A `_feher` változat ugyanaz
 *  (a csempe semleges, nem kell külön fehér háttérre szánt kép). A videóhívásnak nincs saját rajza: a telefon jelzi. */
export const TARGYKEP_UJ = {
  befizetve_pecset: 'pipa-kor',
  befizetve_pecset_feher: 'pipa-kor',
  dosszie_mappa: 'dosszie',
  dosszie_mappa_feher: 'dosszie',
  hatarido_naptar: 'naptar',
  hatarido_naptar_feher: 'naptar',
  level_boritek: 'level',
  level_boritek_feher: 'level',
  meghatalmazas_alairva: 'irat-toll',
  meghatalmazas_alairva_feher: 'irat-toll',
  tepnaptar_3d: 'naptar',
  ures_mappa: 'dosszie',
  videohivas_laptop: 'telefon',
  videohivas_laptop_feher: 'telefon',
} as const satisfies Readonly<Record<string, EmojiNev>>;

export type RegiTargykepNev = keyof typeof TARGYKEP_UJ;

/** Javasolt csempeméret a régi ikon kijelzett mérete (pt/px) alapján:
 *  ≤ 36 → `kicsi` (36-os csempe, 29-es ikon), ≤ 50 → `alap` (42 / 34), afölött `nagy` (64 / 50). A tárgyképek mindig `nagy`. */
export function javasoltCsempe(regiMeret: number): 'kicsi' | 'alap' | 'nagy' {
  if (regiMeret <= 36) return 'kicsi';
  if (regiMeret <= 50) return 'alap';
  return 'nagy';
}
