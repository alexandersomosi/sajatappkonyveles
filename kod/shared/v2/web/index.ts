// Adózz.hu v2 – webes React komponensek (panel: könyvelői felület + konzol).
// Használat a panelben (a sync után):  import { Ikon, Csempe, Kartya, szin } from '../_shared/v2/web';
// A stílusok: a src/main.tsx egyszer importálja a '_shared/v2/web/v2.css'-t (az app.css ELŐTT).
export * from '../index';
export { Ikon, SvgRajz, svgA11y, type IkonProps, type SvgA11y } from './Ikon';
export { VezerloIkon, type VezerloIkonProps } from './VezerloIkon';
export { Csempe, type CsempeProps } from './Csempe';
export { Kartya, kartyaOsztaly, type KartyaProps } from './Kartya';
export { Logo, type LogoProps } from './Logo';
export { GoogleG } from './GoogleG';
