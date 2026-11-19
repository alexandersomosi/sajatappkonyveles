// A jóváhagyott C2 dizájn tokenjei (dizajn/C2_modern/app_v2/tokens.css, 2026-11-18) – ugyanazokkal a nevekkel.
// 11-18 17:50 a tulaj döntése: a márkaszín az élénk kék #1428DB (dizajn/C3_zold/kek.css, dizajn/PALETTA.md).
// A token NEVE (tintakek) a kód stabilitása miatt marad; a régi értékek: kod/_regi/szinvaltas_kek_elotte_1817/.
// Szín, forma, betű. A számok pontban (pt) vannak, mint a 390 × 844-es referencia-képernyőn.
import type { TextStyle } from 'react-native';

export const szin = {
  tintakek: '#1428DB', // márka (élénk kék): fejlécsáv, elsődleges gomb, saját buborék, aktív fül
  tintakekSzoveg: '#1226B8', // link, másodlagos gomb felirata
  tollkek: '#2546A6', // KIZÁRÓLAG a könyvelő kézírásos aláírása, fehér papíron
  tollkekSavon: '#C9D2FF', // ugyanaz a toll a kék sávon (szóvédjegy, app-ikon kézvonása)
  alap: '#E4E8F3', // háttér
  lap: '#FFFFFF',
  tinta: '#10152B', // szöveg
  halvany: '#505873', // másodlagos szöveg fehér lapon
  halvanyAlapon: '#4A5270', // másodlagos szöveg az alapon
  fejlecHalvany: '#C9D2FF', // másodlagos szöveg a sávon
  keret: '#C9D0E4',
  hajszal: '#E2E6F1',
  mezoKeret: '#7D879B',
  mezoAlap: '#F5F7FA',
  nyomott: '#EEF1F6', // semleges szürke: bezáró gomb, csempe, letiltott
  gombMAlap: '#DFE4FD', // EZ A VILÁGOSKÉK CSAK A MÁSODLAGOS GOMBÉ
  gombMNyomott: '#C9D2FB',
  papir: '#F4EFE4',
  papirKeret: '#E2D9C6',
  veszely: '#B42318',
  veszelyAlap: '#FBE9E7', // lejárt-címke alapja (a panel --veszely-alap tokenje)
  veszelySzoveg: '#8A1C12',
  fuggony: 'rgba(13, 22, 40, 0.48)',
  kamera: '#0F1B33',
  kek: '#1428DB', // „+ Fájl hozzáadása”
  borostyan: '#845300',
  borostyanAlap: '#F7E8C6',
  borostyanSzoveg: '#5E3B00',
  fulAktiv: '#1428DB',
  kesz: '#7A62D9', // a pecsét ibolyája (összekötő vonal a kész lépések között, 40% átlátszósággal)
  szegmensFelirat: '#D3DAFB',
  levelPapir: '#FFFFFF',
} as const;

export const forma = {
  lap: 18, // tartalom-lap
  level: 4, // a levél: papír
  sheet: 26, // alsó lap teteje
  mezo: 12, // beviteli mező, kérés-csempe
  cimke: 6, // állapotcímke
  gomb: 999, // kapszula = gomb, és semmi más
  margo: 16,
} as const;

export type Suly = 400 | 500 | 550 | 600 | 650 | 700 | 750 | 800 | 900;

/** Geist a pontos dizájn-súlyban (statikus példányok: scripts/fontok.py). */
export function betu(suly: Suly = 400): TextStyle {
  return { fontFamily: `Geist-W${suly}` };
}

export const BETUK = {
  'Geist-W400': require('../../assets/fonts/Geist-W400.ttf'),
  'Geist-W500': require('../../assets/fonts/Geist-W500.ttf'),
  'Geist-W550': require('../../assets/fonts/Geist-W550.ttf'),
  'Geist-W600': require('../../assets/fonts/Geist-W600.ttf'),
  'Geist-W650': require('../../assets/fonts/Geist-W650.ttf'),
  'Geist-W700': require('../../assets/fonts/Geist-W700.ttf'),
  'Geist-W750': require('../../assets/fonts/Geist-W750.ttf'),
  'Geist-W800': require('../../assets/fonts/Geist-W800.ttf'),
  'Geist-W900': require('../../assets/fonts/Geist-W900.ttf'),
} as const;

/** Táblázatos számok (összegek, dátumok). */
export const szamok: TextStyle = { fontVariant: ['tabular-nums', 'lining-nums'] };

/** Betűköz em-ben → pont (RN-ben a letterSpacing pont). */
export const em = (meret: number, e: number) => meret * e;

/** Árnyék csak a lebegő rétegeken (fülsor, Fotózás-gomb, alsó lap, író sor, levél). */
export const arnyek = {
  papir: {
    shadowColor: '#10153C',
    shadowOpacity: 0.16,
    shadowRadius: 11,
    shadowOffset: { width: 0, height: 8 },
    elevation: 3,
  },
  lebego: {
    shadowColor: '#10153C',
    shadowOpacity: 0.22,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  sheet: {
    shadowColor: '#0D1628',
    shadowOpacity: 0.35,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: -8 },
    elevation: 16,
  },
} as const;
