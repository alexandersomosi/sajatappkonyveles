// A v2 dizájn tokenjei (tulaj 11-20/21, dizajn/C5_v2) – a kulcsnevek a régi C2/C dizájnéi maradnak (kb. 180 fájl
// használja őket), az értékek a közös v2 alapból (kod/shared/v2/tokenek.ts → src/_shared/v2) jönnek.
// k8 (FELÜLET-A): szürke háttér, minden szakasz külön fehér kártya, sárga főgomb sötét felirattal, kék gradiens fejléc.
// A régi értékek: _regi/elotte_k8_A/src/theme/tokens.ts.
import type { TextStyle } from 'react-native';
import { arnyek as v2Arnyek, szin as v2szin, sugar as v2sugar } from '../_shared/v2/tokenek';

export const szin = {
  tintakek: v2szin.kek, // márka: fejléc, aktív fül, saját buborék, kiválasztott
  tintakekSzoveg: v2szin.kek, // link, másodlagos kis gomb felirata (#1428DB fehéren 8,91:1)
  tollkek: '#2546A6', // KIZÁRÓLAG a könyvelő kézírásos aláírása, fehér papíron
  tollkekSavon: '#C9D2FF',
  alap: v2szin.hatter, // a képernyő háttere (#F3F5FB)
  lap: v2szin.kartya,
  tinta: v2szin.sotet, // szöveg
  halvany: v2szin.szurke, // másodlagos szöveg (#5B6478: fehéren 5,93:1, a háttéren 5,44:1)
  halvanyAlapon: v2szin.szurke,
  fejlecHalvany: v2szin.fejHalvany, // másodlagos szöveg a kék fejlécen
  keret: v2szin.keret,
  hajszal: v2szin.vonal,
  // A mező kerete: a minta #DCE2F0-ja fehéren csak 1,3:1 – a WCAG 1.4.11 (nem-szöveges kontraszt, 3:1) miatt a
  // v2 „dekorHalvany” (#8A93A8, 3,08:1) megy rá. Szándékos eltérés a mintától (A_jegyzet).
  mezoKeret: v2szin.dekorHalvany,
  mezoAlap: v2szin.kartya,
  nyomott: v2szin.szurkeAlap, // semleges szürke: bezáró gomb, letiltott
  gombMAlap: v2szin.kekVil, // a kis másodlagos (kék) gomb alapja – kicsi, telt világos pirula, nem nagy doboz
  gombMNyomott: '#D3DBFF',
  papir: '#F4EFE4',
  papirKeret: '#E2D9C6',
  veszely: v2szin.piros,
  veszelyAlap: v2szin.pirosVil, // csak kis címkére
  veszelySzoveg: v2szin.piros,
  fuggony: 'rgba(16, 21, 43, 0.48)',
  kamera: '#0B0F1E',
  kek: v2szin.kek,
  borostyan: v2szin.narancs,
  borostyanAlap: v2szin.narancsVil, // csak kis címkére (a nagy figyelmeztető doboz: jelzoDoboz, fehér + telt bal sáv)
  borostyanSzoveg: v2szin.narancs,
  fulAktiv: v2szin.kek,
  kesz: v2szin.zold, // kész lépések összekötő vonala
  szegmensFelirat: v2szin.fejHalvany,
  levelPapir: v2szin.kartya,
  /** @deprecated a C-dizájn szakasz-sávja; a v2-ben nincs sáv (a kártyák közt a háttér látszik). */
  sav: v2szin.hatter,
  // --- v2 (új nevek) ---
  sarga: v2szin.sarga,
  sargaS: v2szin.sargaS,
  sotet: v2szin.sotet,
  szoveg2: v2szin.szoveg2,
  csempe: v2szin.csempe,
  zold: v2szin.zold,
  zoldVil: v2szin.zoldVil,
  narancs: v2szin.narancs,
  narancsVil: v2szin.narancsVil,
  pont: v2szin.pont,
  kekVil: v2szin.kekVil,
  kekValasztott: v2szin.kekValasztott,
  hoverAlap: v2szin.hoverAlap,
  csikAlap: v2szin.csikAlap,
  dekorNyil: v2szin.dekorNyil,
  dekorHalvany: v2szin.dekorHalvany,
  jeloloKeret: v2szin.jeloloKeret,
  feltoltoKeret: v2szin.feltoltoKeret,
  kapcsoloKi: v2szin.kapcsoloKi,
  szegmensAlap: v2szin.szegmensAlap,
  letiltvaAlap: v2szin.letiltvaAlap,
  letiltvaSzoveg: v2szin.letiltvaSzoveg,
  helykitolto: '#E9ECF4', // álló helykitöltő (skeleton) blokk
} as const;

export const forma = {
  lap: v2sugar.kartya, // kártya (20)
  level: 4, // a levél: papír
  sheet: 26, // alsó lap teteje
  mezo: v2sugar.mezo, // beviteli mező, választó (14)
  cimke: v2sugar.kapszula, // állapotcímke: pirula
  gomb: v2sugar.gomb, // fő és másodlagos gomb (14); a kis gomb pirula (kapszula)
  kapszula: v2sugar.kapszula,
  margo: 12, // a tartalom oldalmargója telefonon (main.lap)
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

/** Árnyékok (v2): RN 0.88 és react-native-web 0.21 is érti a `boxShadow`-t. A régi kulcsnevek maradnak. */
export const arnyek = {
  kartya: { boxShadow: v2Arnyek.kartya.css },
  kartyaEmelt: { boxShadow: '0 2px 4px rgba(16,21,43,.05), 0 12px 28px rgba(16,21,43,.10)' },
  papir: { boxShadow: '0 4px 14px rgba(16,21,43,.10)' },
  lebego: { boxShadow: '0 8px 24px rgba(16,21,43,.18)' },
  sheet: { boxShadow: '0 -8px 28px rgba(16,21,43,.22)' },
  sav: { boxShadow: v2Arnyek.sav.css },
  fejlec: { boxShadow: v2Arnyek.fejlec.css },
  hos: { boxShadow: v2Arnyek.hos.css },
  gomb: { boxShadow: v2Arnyek.gomb.css },
  gombKis: { boxShadow: v2Arnyek.gombKis.css },
  szegmens: { boxShadow: v2Arnyek.szegmens.css },
  mezoFokusz: { boxShadow: v2Arnyek.mezoFokusz.css },
} as const;

export { v2szin };
