// A jogi app-szövegek (kod/jogi/app_szovegek.json, TERVEZET – jogász ellenőrzi) kitöltve. A {{helyőrzők}} értékét a
// hívó adja; a cégadatok és a díj a brand.json-ból jönnek. Hiányzó kulcsnál a megadott tartalék szöveg látszik.
import adat from '../_jogi/app_szovegek.json';
import { brand } from '../config';
import { szam } from './format';

const SZOVEGEK = (adat as { szovegek: Record<string, string | string[]> }).szovegek;

export type Ertekek = Record<string, string | number | undefined>;

function alap(): Ertekek {
  const dij = `${szam(brand.priceHufMonthlyGross)} Ft`;
  return {
    'brand.name': brand.name,
    'dij.havi_brutto': dij,
    'elofizetes.alkalom': 12,
    'elofizetes.honapok': 12,
    'elofizetes.max_osszeg': dij,
    'ceg.nev': brand.provider.legalName,
    'ceg.email': brand.provider.supportEmail,
  };
}

function kitolt(s: string, e: Ertekek): string {
  const ertek = { ...alap(), ...e };
  const kesz = s.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_, k: string) => {
    const v = ertek[k];
    return v === undefined || v === '' ? '…' : String(v);
  });
  // „a(z) X” → „a X” / „az X” a következő szó szerint (a szerveren a jogi szövegeknél ugyanígy).
  return kesz.replace(/(^|[^\p{L}])([Aa])\(z\)(\s+)([[(„"']*)([\p{L}\p{N}])/gu, (_m, elo: string, a: string, sz: string, nyit: string, elso: string) => {
    const az = /^[aáeéiíoóöőuúüű5]/i.test(elso) ? 'az' : 'a';
    return `${elo}${a === 'A' ? az.charAt(0).toUpperCase() + az.slice(1) : az}${sz}${nyit}${elso}`;
  });
}

/** Egyetlen mondat; ha a kulcs listát ad, szóközzel összefűzve. */
export function szoveg(kulcs: string, e: Ertekek = {}, tartalek = ''): string {
  const s = SZOVEGEK[kulcs];
  if (s === undefined) return kitolt(tartalek, e);
  return Array.isArray(s) ? s.map((x) => kitolt(x, e)).join(' ') : kitolt(s, e);
}

/** Felsorolás (pl. következmények). */
export function szovegLista(kulcs: string, e: Ertekek = {}, tartalek: string[] = []): string[] {
  const s = SZOVEGEK[kulcs];
  if (s === undefined) return tartalek.map((x) => kitolt(x, e));
  return (Array.isArray(s) ? s : [s]).map((x) => kitolt(x, e));
}
