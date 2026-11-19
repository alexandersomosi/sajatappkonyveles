// Property tests over many random (seeded, reproducible) profiles and revenue streams.
// No dependency: a seeded mulberry32 PRNG drives the generator.

import { describe, expect, it } from 'vitest';
import { calculateYear, formatHuf, type InsuranceBreak, type RevenueItemInput, type TaxProfileInput, type YearInput, type YearResult } from '../src/index.js';
import { prng } from './helpers.js';

const CASES = 400;

function pad(n: number) {
  return String(n).padStart(2, '0');
}

function randomDate(rnd: () => number, year = 2026): string {
  const m = 1 + Math.floor(rnd() * 12);
  const dim = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return `${year}-${pad(m)}-${pad(1 + Math.floor(rnd() * dim))}`;
}

function randomInput(seed: number): YearInput {
  const rnd = prng(seed);
  const statuses = ['fofoglalkozasu', 'mellekallasu', 'nyugdijas'] as const;
  const ratios = [45, 80, 90] as const;
  const breaks: InsuranceBreak[] = [];
  const nb = Math.floor(rnd() * 3);
  for (let i = 0; i < nb; i++) {
    const a = randomDate(rnd);
    const b = randomDate(rnd);
    breaks.push({ from: a < b ? a : b, to: a < b ? b : a, kind: rnd() < 0.5 ? 'kieso' : 'szunetel' });
  }
  const profile: TaxProfileInput = {
    year: 2026,
    costRatio: ratios[Math.floor(rnd() * 3)]!,
    status: statuses[Math.floor(rnd() * 3)]!,
    guaranteedMinimum: rnd() < 0.3,
    insuranceBreaks: breaks,
    hipa: { method: 'savos', ratePct: Math.round(rnd() * 200) / 100 },
    ...(rnd() < 0.2 ? { atalanyFrom: randomDate(rnd) } : {}),
  };
  const revenue: RevenueItemInput[] = [];
  const n = Math.floor(rnd() * 40);
  for (let i = 0; i < n; i++) {
    const d = randomDate(rnd);
    revenue.push({
      receivedOn: d,
      deliveryDate: rnd() < 0.8 ? d : randomDate(rnd),
      amountHuf: Math.floor(rnd() * 3_000_000),
      countsForAtalany: rnd() < 0.95,
      countsForAfaLimit: rnd() < 0.95,
      ...(rnd() < 0.3 ? { estimated: true } : {}),
    });
  }
  const asOf = rnd() < 0.2 ? '2027-01-20' : randomDate(rnd);
  return { profile, revenue, asOf };
}

const money = (r: YearResult) =>
  r.quarters.flatMap((q) => [
    q.revenueHuf,
    q.incomeHuf,
    q.incomeYtdHuf,
    q.taxableYtdHuf,
    q.cumulativeBasePerMonthHuf,
    q.tbHuf,
    q.szochoHuf,
    q.szjaAdvanceHuf,
    q.totalHuf,
    ...q.months.flatMap((m) => [m.revenueHuf, m.incomeHuf, m.baseHuf, m.tbHuf, m.szochoHuf, m.minimumHuf ?? 0]),
    ...q.payments.map((p) => p.amountHuf),
  ]);

describe('properties over random inputs', () => {
  const inputs = Array.from({ length: CASES }, (_, i) => randomInput(1000 + i));
  const results = inputs.map((inp) => calculateYear(inp));

  it('every amount is a safe integer and never negative (non-negative revenue)', () => {
    for (const r of results) for (const v of money(r)) expect(Number.isSafeInteger(v) && v >= 0).toBe(true);
  });

  it('totals add up: months → quarter, payments → total, explanation tax rows → total', () => {
    for (const r of results)
      for (const q of r.quarters) {
        expect(q.tbHuf + q.szochoHuf + q.szjaAdvanceHuf).toBe(q.totalHuf);
        expect(q.months.reduce((s, m) => s + m.tbHuf, 0)).toBe(q.tbHuf);
        expect(q.months.reduce((s, m) => s + m.szochoHuf, 0)).toBe(q.szochoHuf);
        expect(q.payments.reduce((s, p) => s + p.amountHuf, 0)).toBe(q.totalHuf);
        const ado = q.explanation.lines.filter((l) => l.kind === 'ado').reduce((s, l) => s + (l.amountHuf ?? 0), 0);
        expect(ado).toBe(q.totalHuf);
        expect(q.explanation.result.endsWith(formatHuf(q.totalHuf))).toBe(true);
      }
  });

  it('SZJA is cumulative: advances so far = round(15 % × taxable YTD)', () => {
    for (const r of results) {
      let s = 0;
      for (const q of r.quarters) {
        s += q.szjaAdvanceHuf;
        expect(s).toBe(Math.round(q.taxableYtdHuf * 0.15 + 1e-9));
      }
    }
  });

  it('nyugdíjas never pays TB or szocho', () => {
    results.forEach((r, i) => {
      if (inputs[i]!.profile.status === 'nyugdijas') for (const q of r.quarters) expect(q.tbHuf + q.szochoHuf).toBe(0);
    });
  });

  it('mellékállás: no minimum, base = the rounded cumulative per-month base; cumulative bases track taxable income', () => {
    results.forEach((r, i) => {
      if (inputs[i]!.profile.status !== 'mellekallasu') return;
      for (const q of r.quarters) {
        for (const m of q.months) {
          expect(m.minimumHuf).toBeNull();
          if (m.insured) expect(m.baseHuf).toBe(q.cumulativeBasePerMonthHuf);
        }
        // göngyölítés: prior + this quarter's bases ≈ taxable YTD (± rounding of ≤ 3 months)
        const after = (q.priorActualBaseSumHuf ?? 0) + q.months.reduce((s, m) => s + m.baseHuf, 0);
        if ((q.insuredMonths ?? 0) > 0 && q.taxableYtdHuf >= (q.priorActualBaseSumHuf ?? 0)) expect(Math.abs(after - q.taxableYtdHuf)).toBeLessThanOrEqual(2);
      }
    });
  });

  it('főfoglalkozású: a fully insured month never goes below the minimum; minimum days ≤ insured days', () => {
    results.forEach((r, i) => {
      const p = inputs[i]!.profile;
      if (p.status !== 'fofoglalkozasu') return;
      const full = p.guaranteedMinimum ? 373_200 : 322_800;
      for (const q of r.quarters)
        for (const m of q.months) {
          if (!m.insured) continue;
          expect(m.baseHuf).toBeGreaterThanOrEqual(m.minimumHuf!);
          expect(m.minimumHuf!).toBeLessThanOrEqual(full);
          expect(m.minimumDays!).toBeLessThanOrEqual(m.insuredDays!);
          const dim = new Date(Date.UTC(2026, m.month, 0)).getUTCDate();
          if (m.minimumDays === dim) expect(m.baseHuf).toBeGreaterThanOrEqual(full);
        }
    });
  });

  it('meters: projected ≥ used, ratio = used / limit, revenueByMonth sums to the cap meter', () => {
    for (const r of results) {
      expect(r.meters.afa.projectedHuf).toBeGreaterThanOrEqual(r.meters.afa.usedHuf);
      expect(r.meters.atalanyCap.projectedHuf).toBeGreaterThanOrEqual(r.meters.atalanyCap.usedHuf);
      expect(Math.abs(r.meters.afa.ratio - r.meters.afa.usedHuf / r.meters.afa.limitHuf)).toBeLessThan(0.0001);
      expect(r.revenueByMonth.reduce((s, m) => s + m.amountHuf, 0)).toBe(r.meters.atalanyCap.usedHuf);
    }
  });

  it('monotonic in revenue: more revenue in a month never lowers that quarter, the yearly SZJA, or (beyond rounding) the yearly járulék', () => {
    const rnd = prng(42);
    let checked = 0;
    inputs.forEach((inp, i) => {
      const before = results[i]!;
      if (before.quarters.length === 0) return;
      const q = before.quarters[Math.floor(rnd() * before.quarters.length)]!;
      const month = (q.quarter - 1) * 3 + 1 + Math.floor(rnd() * 3);
      const day = `2026-${pad(month)}-01`;
      const start = inp.profile.atalanyFrom ?? '2026-01-01';
      if (day > inp.asOf || day < start) return;
      const extra = 1 + Math.floor(rnd() * 2_000_000);
      const after = calculateYear({
        ...inp,
        revenue: [...inp.revenue, { receivedOn: day, deliveryDate: day, amountHuf: extra, countsForAtalany: true, countsForAfaLimit: true }],
      });
      const qa = after.quarters.find((x) => x.quarter === q.quarter)!;
      expect(qa.totalHuf).toBeGreaterThanOrEqual(q.totalHuf);
      expect(qa.tbHuf).toBeGreaterThanOrEqual(q.tbHuf);
      const szja = (r: YearResult) => r.quarters.reduce((s, x) => s + x.szjaAdvanceHuf, 0);
      const jar = (r: YearResult) => r.quarters.reduce((s, x) => s + x.tbHuf + x.szochoHuf, 0);
      expect(szja(after)).toBeGreaterThanOrEqual(szja(before));
      expect(jar(after)).toBeGreaterThanOrEqual(jar(before) - 12); // per-month forint rounding can shift ≤ 1 Ft / month
      checked++;
    });
    expect(checked).toBeGreaterThan(100);
  });

  it('later asOf never removes received revenue', () => {
    for (const inp of inputs.slice(0, 100)) {
      const a = calculateYear(inp);
      const b = calculateYear({ ...inp, asOf: '2027-01-20' });
      expect(b.meters.atalanyCap.usedHuf).toBeGreaterThanOrEqual(a.meters.atalanyCap.usedHuf);
    }
  });
});
