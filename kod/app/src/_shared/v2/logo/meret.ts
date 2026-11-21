// GENERATED from kod/shared/v2 – do not edit here. Edit kod/shared/v2 and re-run sync-v2.
// GENERÁLT – kézzel ne írd: node kod/shared/v2/scripts/logo-kep.cjs
// A logóképek pixelmérete és hogy mekkora betűméretre készültek. Megjelenítés `meret` px-es betűvel:
// szélesség = kep[0] / skala * meret / betu, magasság = kep[1] / skala * meret / betu.
export const LOGO_KEP = {
  betu: 30,
  skala: 4,
  kek: [552, 151],
  feher: [552, 151],
} as const;

/** A logó mérete (pt/px) adott betűméretnél (a v2.js `data-meret`-je; fejlécben 26–30, gépes menüben 30). */
export function logoMeret(betuMeret: number, feher = false): { width: number; height: number } {
  const [w, h] = feher ? LOGO_KEP.feher : LOGO_KEP.kek;
  const k = betuMeret / LOGO_KEP.betu / LOGO_KEP.skala;
  return { width: Math.round(w * k * 10) / 10, height: Math.round(h * k * 10) / 10 };
}

/** A logó felolvasói neve. */
export const LOGO_ALT = 'Adózz.hu';
