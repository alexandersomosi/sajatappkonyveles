// SPEC §32.B – the panel's pure helpers of the annual cycle (tested in lib/eves.test.ts): the live difference of the amounts
// form (the same rule as the server), the folyószámla row difference and the suggested status, the year overview CSV.
import type { AnnualAmountsInput, ReconStatus, YearOverviewRow } from '../_shared/eves';

/** One CSV cell for Excel (";"): a text that starts like a formula gets a leading apostrophe (as the backend's csvCell). */
export function csvCell(s: string | number | null | undefined): string {
  let v = String(s ?? '');
  if (typeof s !== 'number' && /^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return /[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
}

const n0 = (v: number | null | undefined) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

/** + to pay / − refund. átalány: A − B + C + Σ egyéb; KATA: the különadó. */
export function evesKulonbozet(regime: 'atalany' | 'kata', a: Partial<AnnualAmountsInput>): number {
  if (regime === 'kata') return Math.max(0, n0(a.kulonadoHuf));
  return n0(a.szjaHuf) - n0(a.advancesHuf) + n0(a.csjkHuf) + (a.otherLines ?? []).reduce((s, l) => s + n0(l.amountHuf), 0);
}

/** The amber line when the accountant's difference and the app's estimate are more than 1 000 Ft apart (never a block). */
export function motorElteres(sajat: number, becsles: number | null | undefined, kuszob = 1_000): number | null {
  if (becsles === null || becsles === undefined) return null;
  const d = sajat - becsles;
  return Math.abs(d) > kuszob ? d : null;
}

/** NAV balance − pending − what the app expects as not marked. */
export function folyoszamlaElteres(balanceHuf: number, pendingHuf: number, expectedUnmarkedHuf: number): number {
  return balanceHuf - pendingHuf - expectedUnmarkedHuf;
}

/** The status the numbers suggest (the server suggests the same; the accountant may change it). */
export function folyoszamlaJavaslat(rows: { balanceHuf: number; pendingHuf: number; diffHuf: number }[]): ReconStatus {
  const debt = rows.reduce((a, b) => a + Math.max(0, b.balanceHuf - b.pendingHuf), 0);
  if (debt > 0) return rows.some((b) => b.diffHuf !== 0) ? 'elteres' : 'hatralek';
  if (rows.some((b) => b.balanceHuf < 0)) return 'tulfizetes';
  return 'rendben';
}

/** "Rendben" from a statement row only with the item's exact amount (critique 2.4). */
export function lattamRendbenLehet(itemHuf: number, kivonatHuf: number | null): boolean {
  return kivonatHuf !== null && kivonatHuf === itemHuf;
}

/** The year overview as CSV (";" separated, Excel-safe cells). */
export function attekintoCsv(rows: YearOverviewRow[]): string {
  const head = ['Ügyfél', 'Adózási mód', 'Negyedévek / kata', 'Folyószámla', 'Éves zárás', 'Különbözet', 'HIPA', 'Nyitott önellenőrzés', 'Mi hiányzik'];
  const lines = rows.map((r) =>
    [
      r.name,
      r.regime === 'kata' ? 'Kata' : 'Átalány',
      r.kata ? `${r.kata.ok} rendben, ${r.kata.open} hiányzik, ${r.kata.unverified} ellenőrizetlen` : r.quarters.map((q) => `${q.key.slice(5)}: ${q.state}${q.filed ? ' (beadva)' : ''}`).join(', '),
      r.reconciliation ? `${r.reconciliation.asOf} ${r.reconciliation.status}${r.reconciliation.nextCheckOn ? `, következő: ${r.reconciliation.nextCheckOn}` : ''}` : 'nincs',
      r.annual ? r.annual.status : '',
      r.difference ? `${r.difference.diffHuf} (${r.difference.label})` : '',
      `előleg: ${r.hipa.advance}, éves: ${r.hipa.annual}`,
      r.openCorrections,
      r.missing.join(' · '),
    ]
      .map((x) => csvCell(x))
      .join(';'),
  );
  return [head.map((x) => csvCell(x)).join(';'), ...lines].join('\r\n');
}
