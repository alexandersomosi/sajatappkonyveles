// SPEC §32 – the panel's KATA rules (pure; every function has a unit test in kata.test.ts): the month status chip,
// which months can be ticked for "Rendben (folyószámla alapján)", the free-month form validation, the bar colour.
import { KATA_EXEMPT_KINDS, KATA_PANEL_TEXTS, kataExemptNeedsReport, type KataBreak, type KataMonthView } from '../_shared/kata';

export type KataChip = { szoveg: string; tipus: 'ok' | 'info' | 'figyel' | 'hiba' | 'semleges' };

/** The status chip of a KATA month row. */
export function kataHonapCimke(m: Pick<KataMonthView, 'status' | 'overdue' | 'exemptReasonLabel' | 'paidButExempt'>): KataChip {
  const t = KATA_PANEL_TEXTS.allapot;
  if (m.paidButExempt) return { szoveg: 'Befizette, de mentes', tipus: 'hiba' };
  switch (m.status) {
    case 'ellenorizve':
      return { szoveg: t.ellenorizve, tipus: 'ok' };
    case 'befizetve_jelezve':
      return { szoveg: t.befizetve_jelezve, tipus: 'info' };
    case 'elteres':
      return { szoveg: t.elteres, tipus: 'hiba' };
    case 'mentes':
      return { szoveg: `${t.mentes}${m.exemptReasonLabel ? ` – ${m.exemptReasonLabel}` : ''}`, tipus: 'semleges' };
    case 'nincs_osszeg':
      return { szoveg: t.nincs_osszeg, tipus: 'figyel' };
    case 'ellenorizetlen':
      return { szoveg: t.ellenorizetlen, tipus: 'figyel' };
    default:
      return m.overdue ? { szoveg: `${t.fizetendo} – lejárt`, tipus: 'hiba' } : { szoveg: t.fizetendo, tipus: 'semleges' };
  }
}

/** A row the group "Rendben" may tick: it has an item and is not verified yet (marked, unmarked, or before the app). */
export function kijelolheto(m: Pick<KataMonthView, 'periodId' | 'status'>): boolean {
  return Boolean(m.periodId) && (m.status === 'befizetve_jelezve' || m.status === 'fizetendo' || m.status === 'ellenorizetlen');
}

/** Validation of the free-month list before PUT /kata/breaks; null = ok. */
export function kataSzunetHiba(breaks: KataBreak[], ev: number, ma: string): string | null {
  for (const b of breaks) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(b.from) || !/^\d{4}-\d{2}-\d{2}$/.test(b.to)) return 'Add meg a kezdetet és a véget (ÉÉÉÉ-HH-NN).';
    if (b.from > b.to) return 'A kezdet nem lehet a vég után.';
    if (b.to < `${ev}-01-01` || b.from > `${ev}-12-31`) return `Az időszaknak ${ev}-re kell esnie.`;
    if (!(KATA_EXEMPT_KINDS as readonly string[]).includes(b.kind)) return 'Válassz okot.';
    if (b.reportedOn && b.reportedOn > ma) return 'A bejelentés napja nem lehet a jövőben.';
  }
  return null;
}

/** "Bejelentve" is asked only for a)–c) (7. § (10)); szünetelésnél nem kell. */
export function bejelentesKell(kind: KataBreak['kind']): boolean {
  return kataExemptNeedsReport(kind);
}

/** "szeptember" → "Szeptemberben" (the inessive of a month name, capitalised – javító kör 11-21). */
const BAN = new Set(['január', 'február', 'március', 'április', 'május', 'június', 'július', 'augusztus']);
export function honapban(honap: string): string {
  const h = honap.toLocaleLowerCase('hu-HU');
  return `${h.charAt(0).toLocaleUpperCase('hu-HU')}${h.slice(1)}${BAN.has(h) ? 'ban' : 'ben'}`;
}

/** The bar colour by level (panel CSS variables). */
export function kataSavSzin(level: 'rendben' | 'figyelem' | 'tullepve'): string {
  return level === 'tullepve' ? 'var(--veszely)' : level === 'figyelem' ? 'var(--borostyan)' : 'var(--tintakek)';
}
