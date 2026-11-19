// SPEC §27.11 T1 (round-2 tax BLOCKER): revenue that lands in an already approved quarter must not vanish.
// The approved quarters' sums are the prior sums of the later quarters (NAV 100. füzet 4. and 6.1), so the
// difference moves into the next open quarter, and the accountant gets a warning.

import { describe, expect, it } from 'vitest';
import { AdoMotorInputError, calculateYear, type ApprovedQuarterActual, type YearInput, type YearResult } from '../src/index.js';
import { demoInput } from './helpers.js';

const approvedFrom = (r: YearResult, upTo: number): ApprovedQuarterActual[] =>
  r.quarters
    .filter((q) => q.quarter <= upTo)
    .map((q) => ({
      quarter: q.quarter,
      baseSumHuf: q.months.reduce((a, m) => a + m.baseHuf, 0),
      szjaAdvanceHuf: q.szjaAdvanceHuf,
      revenueHuf: q.revenueHuf,
    }));

const withItem = (inp: YearInput, receivedOn: string, amountHuf: number): YearInput => ({
  ...inp,
  revenue: [...inp.revenue, { receivedOn, deliveryDate: receivedOn, amountHuf, countsForAtalany: true, countsForAfaLimit: true }],
});

describe('approved quarters (SPEC §27.11 T1)', () => {
  it('approved sums equal to the engine’s → same results, no warning', () => {
    const base = demoInput('kata');
    const r0 = calculateYear(base);
    const r1 = calculateYear({ ...base, approvedQuarters: approvedFrom(r0, 3) });
    expect(r1.quarters.map((q) => q.totalHuf)).toEqual(r0.quarters.map((q) => q.totalHuf));
    expect(r1.quarters.map((q) => q.coveredByPriorOverride)).toEqual(r0.quarters.map((q) => q.coveredByPriorOverride));
    expect(r1.warnings.some((w) => w.code === 'jovahagyott_negyedev_valtozott')).toBe(false);
  });

  it('Kata: +1 000 000 Ft received 2026-09-20 after the Q3 approval → Q4 SZJA-előleg +82 500 Ft, accountant warned', () => {
    const base = demoInput('kata');
    const r0 = calculateYear(base);
    const late = withItem(base, '2026-09-20', 1_000_000);
    // Before the fix: the cumulative method put the whole difference into (already approved) Q3.
    const old = calculateYear(late);
    expect(old.quarters[3]!.szjaAdvanceHuf).toBe(r0.quarters[3]!.szjaAdvanceHuf);
    const r = calculateYear({ ...late, approvedQuarters: approvedFrom(r0, 3) });
    expect(r.quarters[3]!.szjaAdvanceHuf - r0.quarters[3]!.szjaAdvanceHuf).toBe(82_500); // 1 000 000 × 55 % × 15 %
    expect(r.quarters[3]!.totalHuf - r0.quarters[3]!.totalHuf).toBeGreaterThanOrEqual(82_500);
    expect(r.quarters[3]!.priorSzjaAdvanceSumHuf).toBe(r0.quarters[3]!.priorSzjaAdvanceSumHuf);
    const w = r.warnings.find((x) => x.code === 'jovahagyott_negyedev_valtozott')!;
    expect(w.audience).toBe('konyvelo');
    expect(w.text).toContain('3. negyedév');
    expect(w.text).toContain('Lezárt negyedév bevétele változott');
  });

  it('revenue moved from Q4 back into the approved Q3 keeps the Q4 amount (nothing is lost)', () => {
    const base = demoInput('kata');
    const r0 = calculateYear(base);
    const idx = base.revenue.findIndex((i) => i.countsForAtalany && i.receivedOn >= '2026-10-01' && i.receivedOn <= base.asOf);
    expect(idx).toBeGreaterThanOrEqual(0);
    const moved: YearInput = { ...base, revenue: base.revenue.map((i, k) => (k === idx ? { ...i, receivedOn: '2026-09-30' } : i)) };
    const old = calculateYear(moved);
    expect(old.quarters[3]!.totalHuf).toBeLessThan(r0.quarters[3]!.totalHuf); // the bug: Q4 dropped
    const r = calculateYear({ ...moved, approvedQuarters: approvedFrom(r0, 3) });
    expect(r.quarters[3]!.totalHuf).toBe(r0.quarters[3]!.totalHuf);
    expect(r.warnings.some((w) => w.code === 'jovahagyott_negyedev_valtozott')).toBe(true);
  });

  it('a quarter covered by priorOverrides keeps the override (previous accountant wins)', () => {
    const base = demoInput('kata');
    const r0 = calculateYear(base);
    const profile = { ...base.profile, priorOverrides: { throughQuarter: 2 as const, priorActualBaseSum: 1_936_800, priorSzjaAdvanceSum: 100_000 } };
    const a = calculateYear({ ...base, profile });
    const b = calculateYear({ ...base, profile, approvedQuarters: approvedFrom(r0, 2) });
    expect(b.quarters.map((q) => q.totalHuf)).toEqual(a.quarters.map((q) => q.totalHuf));
  });

  it('validation: bad approved quarters are refused with field paths', () => {
    const base = demoInput('kata');
    const bad = (aq: unknown): Record<string, string> => {
      try {
        calculateYear({ ...base, approvedQuarters: aq as ApprovedQuarterActual[] });
      } catch (e) {
        if (e instanceof AdoMotorInputError) return e.fields;
        throw e;
      }
      return {};
    };
    expect(Object.keys(bad('x'))).toEqual(['approvedQuarters']);
    expect(Object.keys(bad([{ quarter: 5, baseSumHuf: 0, szjaAdvanceHuf: 0 }]))).toEqual(['approvedQuarters[0].quarter']);
    expect(Object.keys(bad([{ quarter: 1, baseSumHuf: -1, szjaAdvanceHuf: 0 }]))).toEqual(['approvedQuarters[0].baseSumHuf']);
    expect(Object.keys(bad([{ quarter: 1, baseSumHuf: 0, szjaAdvanceHuf: 0 }, { quarter: 1, baseSumHuf: 0, szjaAdvanceHuf: 0 }]))).toEqual(['approvedQuarters[1].quarter']);
  });
});
