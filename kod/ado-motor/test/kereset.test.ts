// SPEC §28.4 – "Mennyit kerestem?": monthly attribution and the year-end projection (2026, 45 %, HIPA sávos 2 %).

import { describe, expect, it } from 'vitest';
import { calculateYear, earningsByMonth, projectYear, type TaxStatus } from '../src/index.js';
import { monthly } from './helpers.js';

const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
const evenYear = monthly(Object.fromEntries(ALL.map((m) => [m, 1_000_000])), 2026, 10);
const prof = (status: TaxStatus) => ({ year: 2026, costRatio: 45 as const, status, guaranteedMinimum: false, hipa: { method: 'savos' as const, ratePct: 2 } });

describe('E1 mellékállású even year, asOf 2026-12-31 (12 000 000 → band a, HIPA 50 000)', () => {
  const r = calculateYear({ profile: prof('mellekallasu'), revenue: evenYear, asOf: '2026-12-31' });
  const e = earningsByMonth(r, { hipaAnnualHuf: r.hipa!.annualHuf });
  it('January net 995 833 (HIPA 4 167); April 813 217 (SZJA 39 480, TB 84 064, szocho 59 072); May SZJA 82 500', () => {
    expect(r.hipa!.annualHuf).toBe(50_000);
    expect(e[0]).toMatchObject({ revenueHuf: 1_000_000, hipaHuf: 4_167, netHuf: 995_833 });
    expect(e[3]).toMatchObject({ szjaHuf: 39_480, tbHuf: 84_064, szochoHuf: 59_072, hipaHuf: 4_167, netHuf: 813_217 });
    expect(e[4]!.szjaHuf).toBe(82_500);
  });
  it('months 1–6: revenue 6 000 000, taxes 658 888, net 5 341 112; HIPA months sum to 50 000; quarters sum exactly', () => {
    const h = e.slice(0, 6);
    expect(h.reduce((a, x) => a + x.revenueHuf, 0)).toBe(6_000_000);
    expect(h.reduce((a, x) => a + x.szjaHuf + x.tbHuf + x.szochoHuf + x.hipaHuf, 0)).toBe(658_888);
    expect(h.reduce((a, x) => a + x.netHuf, 0)).toBe(5_341_112);
    expect(e.reduce((a, x) => a + x.hipaHuf, 0)).toBe(50_000);
    r.quarters.forEach((q, i) => {
      const ms = e.slice(i * 3, i * 3 + 3);
      expect(ms.reduce((a, x) => a + x.szjaHuf, 0)).toBe(q.szjaAdvanceHuf);
      expect(ms.reduce((a, x) => a + x.tbHuf, 0)).toBe(q.tbHuf);
    });
  });
});

describe('E2 főfogl., revenue Feb–Dec only', () => {
  it('January net −105 849 (TB 59 718 + szocho 41 964 + HIPA 4 167)', () => {
    const r = calculateYear({ profile: prof('fofoglalkozasu'), revenue: evenYear.slice(1), asOf: '2026-12-31' });
    const e = earningsByMonth(r, { hipaAnnualHuf: r.hipa!.annualHuf });
    expect(e[0]).toMatchObject({ revenueHuf: 0, tbHuf: 59_718, szochoHuf: 41_964, hipaHuf: 4_167, netHuf: -105_849 });
  });
});

describe('E3 projection, mellékállású even year, asOf 2026-06-30', () => {
  it('projected revenue 12 099 448 → HIPA band b (120 000); taxes from one whole-year run', () => {
    const p = projectYear({ profile: prof('mellekallasu'), revenue: evenYear, asOf: '2026-06-30' });
    expect(p.reliable).toBe(true);
    expect(p.revenueHuf).toBe(12_099_448); // roundDiv(6 000 000 × 365, 181)
    expect(p.hipaHuf).toBe(120_000); // 6 000 000 × 2 %
    // the remaining 6 099 448 spread over Jul–Dec by days (184), computed once for the whole year
    expect(p.taxesHuf).toBe(2_313_818);
    expect(p.netHuf).toBe(12_099_448 - 2_313_818);
  });
  it('not reliable before 60 active days', () => {
    const p = projectYear({ profile: prof('mellekallasu'), revenue: evenYear, asOf: '2026-02-15' });
    expect(p.reliable).toBe(false);
  });
});

describe('E4 an approved quarter with an override', () => {
  it('the months of Q3 sum to the approved total (TB +10 000)', () => {
    const r = calculateYear({ profile: prof('mellekallasu'), revenue: evenYear, asOf: '2026-12-31' });
    const q3 = r.quarters[2]!;
    const approved = { '2026-Q3': { tbHuf: q3.tbHuf + 10_000, szochoHuf: q3.szochoHuf, szjaHuf: q3.szjaAdvanceHuf } };
    const e = earningsByMonth(r, { hipaAnnualHuf: 0, approved });
    const ms = e.slice(6, 9);
    expect(ms.reduce((a, x) => a + x.tbHuf, 0)).toBe(q3.tbHuf + 10_000);
    expect(ms.reduce((a, x) => a + x.tbHuf + x.szochoHuf + x.szjaHuf, 0)).toBe(q3.totalHuf + 10_000);
  });
  it('an approved part where the engine has 0 is spread evenly over the insured months', () => {
    const r = calculateYear({ profile: prof('mellekallasu'), revenue: evenYear, asOf: '2026-12-31' });
    const e = earningsByMonth(r, { hipaAnnualHuf: 0, approved: { '2026-Q1': { tbHuf: 3_000, szochoHuf: 0, szjaHuf: 0 } } });
    expect(e.slice(0, 3).map((x) => x.tbHuf)).toEqual([1_000, 1_000, 1_000]);
  });
});
