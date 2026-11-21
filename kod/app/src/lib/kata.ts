// SPEC §32 – a közös fizetési lap (/fizetes/[id]) és a kata-keret sáv tiszta segédfüggvényei (tesztelhetők, nincs UI).
// A szövegek a közös szerződésből jönnek (kod/shared/src/kata.ts), tegezve, időígéret nélkül.
import type { KataHomeView, PaymentItem, TaxPeriodDetail } from '../_shared/api';
import { fillPlaceholders } from '../_shared/bekotes';
import { PAYMENT_SHEET_TEXTS as P } from '../_shared/kata';
import { datum, datumIg } from './format';

/** Mit mutat a fizetési lap. */
export type FizetesAllapot =
  /** még nincs jóváhagyva (pl. egy becslés) – nincs számlaszám, nincs gomb */
  | 'nincs_jovahagyva'
  /** 2027-es kata, az összeget a könyvelő még megerősíti (T/928) */
  | 'nincs_osszeg'
  /** mentes kata-hónap (táppénz, CSED, szünetelés…) */
  | 'mentes'
  | 'fizetendo'
  /** az ügyfél jelölte, a könyvelő még nem ellenőrizte */
  | 'jelolve'
  | 'rendben'
  | 'elteres';

export function fizetesAllapot(d: Pick<TaxPeriodDetail, 'kind' | 'calcStatus' | 'paymentStatus' | 'items' | 'exemptReasonLabel'>): FizetesAllapot {
  if (d.kind === 'kata' && d.exemptReasonLabel && !d.items.length) return 'mentes';
  if (d.calcStatus !== 'jovahagyva') return d.kind === 'kata' ? 'nincs_osszeg' : 'nincs_jovahagyva';
  if (d.paymentStatus === 'elteres') return 'elteres';
  if (d.paymentStatus === 'ellenorizve') return 'rendben';
  if (d.paymentStatus === 'befizetve_jelezve') return 'jelolve';
  if (!d.items.length) return 'mentes';
  return 'fizetendo';
}

/** A még nem jelölt tételek (a többit nem kell újra utalni). */
export function nyitottTetelek(items: PaymentItem[]): PaymentItem[] {
  return items.filter((i) => !i.markedPaidAt && i.verification !== 'rendben');
}

/** A lap fejléce: cím, alcím (határidő vagy lejárt), és „{n} külön tétel” sor, ha több számlára kell utalni. */
export function fizetesFej(d: Pick<TaxPeriodDetail, 'label' | 'dueDate' | 'items'> & { sheetTitle?: string }, ma: string): { cim: string; al: string; tobb: string | null } {
  const cim = d.sheetTitle ?? d.label;
  const lejart = d.dueDate < ma;
  const al = lejart ? fillPlaceholders(P.alLejart, { datum: datum(d.dueDate) }) : fillPlaceholders(P.alNyitott, { hatarido: datumIg(d.dueDate) });
  const n = nyitottTetelek(d.items).length;
  return { cim, al, tobb: n > 1 ? fillPlaceholders(P.alTobb, { n: String(n) }) : null };
}

/** Az állapot mondata a lap alján ({firstName} = a könyvelő). null: a gomb látszik. */
export function allapotMondat(a: FizetesAllapot, fn: string, ok?: string | null): string | null {
  switch (a) {
    case 'jelolve':
      return fillPlaceholders(P.jelolve, { firstName: fn });
    case 'rendben':
      return fillPlaceholders(P.rendben, { firstName: fn });
    case 'elteres':
      return fillPlaceholders(P.elteres, { firstName: fn });
    case 'mentes':
      return fillPlaceholders(P.mentes, { ok: ok ?? '' }).replace(' ()', '');
    case 'nincs_osszeg':
      return fillPlaceholders(P.nincsOsszeg, { firstName: fn });
    case 'nincs_jovahagyva':
      return fillPlaceholders(P.nincsJovahagyva, { firstName: fn });
    default:
      return null;
  }
}

/** A másolandó érték: a számlaszám és az összeg szóköz és „Ft” nélkül, a közlemény ahogy van. */
export function masolando(mit: 'szamlaszam' | 'kozlemeny' | 'osszeg', t: Pick<PaymentItem, 'accountNumber' | 'reference' | 'amountHuf'>): string {
  if (mit === 'osszeg') return String(t.amountHuf);
  if (mit === 'szamlaszam') return t.accountNumber.replace(/\s/g, '');
  return t.reference;
}

/** A kata-keret sáv színe: zöld, borostyán ≥ 80 %, piros a keret fölött. */
export function keretSzin(level: KataHomeView['level']): 'zold' | 'borostyan' | 'piros' {
  return level === 'tullepve' ? 'piros' : level === 'figyelem' ? 'borostyan' : 'zold';
}

/** A sáv kitöltése 0–100 között (a keret fölött is legfeljebb tele). */
export function savKitoltes(usedPct: number): number {
  if (!Number.isFinite(usedPct) || usedPct < 0) return 0;
  return Math.min(100, Math.round(usedPct));
}
