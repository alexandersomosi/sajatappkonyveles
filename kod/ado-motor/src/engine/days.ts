// Classifies every day of the tax year: is it insured (subject to járulék), and does the
// minimum apply to it? Months are then summarised for the quarterly base calculation.

import type { InsuranceBreak, TaxStatus } from '../types.js';
import { dayNumber, daysInMonth, toIso } from '../util/dates.js';

export type NotInsuredReason = 'kezdes' | 'szunetel';

export interface MonthDays {
  month: number;
  daysInMonth: number;
  /** Days with insurance (on or after the start, not in a month suspended on every day). */
  insuredDays: number;
  /** Insured days that are kieső (táppénz etc.): no minimum for them. */
  kiesoDays: number;
  /** insuredDays − kiesoDays: the minimum is prorated to these days. */
  minimumDays: number;
  /** Days of a szünetelés that did not cover the whole month (they still carry the minimum). */
  partlySuspendedDays: number;
  /** Why some days were not insured (for the explanation). */
  notInsuredReasons: NotInsuredReason[];
}

/**
 * Szünetelés (Tbj. 40. § (5), in force since 2024, NAV 100 ch. 6.1): only a month suspended on
 * every day drops out. "Ha a szünetelés nem áll fenn a hónap minden napján, akkor nem lehet
 * arányosítást alkalmazni" – a partly suspended month carries the full minimum, so its suspended
 * days count as minimum days. The 1/30 proration stays for the start of the activity and for kieső
 * days (táppénz, csed, gyed …).
 *
 * @param start first day of átalányadózás in this year ('YYYY-01-01' for a whole year)
 * @param status nyugdíjas → no month is insured
 */
export function classifyMonths(year: number, start: string, breaks: readonly InsuranceBreak[], status: TaxStatus): MonthDays[] {
  const startN = dayNumber(start);
  const szunetel = breaks.filter((b) => b.kind === 'szunetel').map((b) => [dayNumber(b.from), dayNumber(b.to)] as const);
  const kieso = breaks.filter((b) => b.kind === 'kieso').map((b) => [dayNumber(b.from), dayNumber(b.to)] as const);
  const inAny = (n: number, ranges: readonly (readonly [number, number])[]) => ranges.some(([a, b]) => n >= a && n <= b);

  const out: MonthDays[] = [];
  for (let m = 1; m <= 12; m++) {
    const dim = daysInMonth(year, m);
    const first = dayNumber(toIso(year, m, 1));
    const reasons = new Set<NotInsuredReason>();
    // Days on or after the start, split into suspended and active ones.
    const active: number[] = [];
    let suspended = 0;
    for (let i = 0; i < dim; i++) {
      const n = first + i;
      if (status === 'nyugdijas') continue;
      if (n < startN) {
        reasons.add('kezdes');
        continue;
      }
      if (inAny(n, szunetel)) suspended++;
      active.push(n);
    }
    const wholeMonthSuspended = active.length > 0 && suspended === active.length;
    let insured = 0;
    let kiesoDays = 0;
    if (wholeMonthSuspended) reasons.add('szunetel');
    else {
      insured = active.length;
      kiesoDays = active.filter((n) => inAny(n, kieso)).length;
    }
    out.push({
      month: m,
      daysInMonth: dim,
      insuredDays: insured,
      kiesoDays,
      minimumDays: insured - kiesoDays,
      partlySuspendedDays: wholeMonthSuspended ? 0 : suspended,
      notInsuredReasons: [...reasons],
    });
  }
  return out;
}
