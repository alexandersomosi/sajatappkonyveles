// SPEC §32.B – az éves bevallás jóváhagyása, a különbözet, a visszajáró, a „Mikor mi jön” idővonal és az önellenőrzés tiszta
// segédfüggvényei (tesztelhetők, nincs UI). A szövegek a közös szerződésből jönnek (kod/shared/src/eves.ts).
import type { AnnualView } from '../_shared/api';
import type { AnnualSummaryLine, AnnualTimelineStatus, TaxCorrectionView } from '../_shared/eves';
import { EVES_TEXTS } from '../_shared/eves';

/** A sor felirata az idővonalon: „Kész”, „Most”, „Lejárt”; a jövőbeli sor csak dátum. */
export function idovonalCimke(s: AnnualTimelineStatus): string {
  return EVES_TEXTS.allapot[s];
}

/** Egy összesítő-sor megjelenése: előjel a szám előtt („−” levonás, „+” hozzáadás), a szám mindig pozitív. */
export function osszegSor(l: AnnualSummaryLine): { cim: string; huf: number; elotte: string | null; al: string | null } {
  return { cim: l.label, huf: Math.abs(l.amountHuf), elotte: l.sign === '−' ? '−' : l.sign === '+' ? '+' : null, al: l.note ?? null };
}

/** Hova visz a „Átnézem és jóváhagyom”: az összesítő (ha a könyvelő beírta az összegeket), különben a tervezet irata. */
export function jovahagyasUt(a: Pick<AnnualView, 'status' | 'summary' | 'draft'>): string | null {
  if (a.status !== 'jovahagyasra_var') return null;
  if (a.summary) return '/eves-zaras/jovahagyas';
  return a.draft ? `/tetel/${a.draft.id}` : null;
}

/** Jóváhagyható-e most: a tervezet ügyfélre vár, van hash, és még nem hagyta jóvá. */
export function jovahagyhato(a: Pick<AnnualView, 'status' | 'approvalHash' | 'approval'>): boolean {
  return a.status === 'jovahagyasra_var' && Boolean(a.approvalHash) && !a.approval;
}

/** A beadás utáni kártya gombja: a nyitott különbözet fizetési lapja, ha van. */
export function kulonbozetUt(a: Pick<AnnualView, 'settlement'>): string | null {
  const s = a.settlement;
  if (!s?.periodId) return null;
  return s.paymentStatus === 'ellenorizve' ? null : `/fizetes/${s.periodId}`;
}

/** Az önellenőrzés eredménysora: „Összesen fizetendő …” vagy „A javadra javítunk …” (null: egyik sem). */
export function onellEredmeny(v: Pick<TaxCorrectionView, 'totalHuf' | 'inFavourHuf'>): 'fizetendo' | 'javara' | null {
  if (v.totalHuf > 0) return 'fizetendo';
  if (v.inFavourHuf > 0) return 'javara';
  return null;
}
